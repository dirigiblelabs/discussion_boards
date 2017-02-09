(function(angular){
"use strict";

//angular'ized extenral dependencies
angular.module('$moment', [])
.factory('$moment', ['$window', function($window) {
  return $window.moment;
}]);

angular.module('$ckeditor', [])
.factory('$ckeditor', ['$window', function($window) {
  return $window.CKEDITOR;
}]);


angular.module('discussion-boards', ['$moment', '$ckeditor', 'ngSanitize', 'ngAnimate', 'ngResource', 'ui.router', 'ui.bootstrap', 'angular-loading-bar', 'angularFileUpload','angular-timeline','angular-scroll-animate', 'ngTagsInput'])
.constant('CONFIG', {
	'LOGIN_URL' : 'login/login.html'
})
.config(['$stateProvider', '$urlRouterProvider', 'cfpLoadingBarProvider', 'CONFIG', function($stateProvider, $urlRouterProvider, cfpLoadingBarProvider, CONFIG) {

		$urlRouterProvider.otherwise("/");
		
		$stateProvider	
		.state('list', {
			url: "/",
			resolve: {
				loggedUser: ['$LoggedUser', '$log', function($LoggedUser, $log){
					return $LoggedUser.get()
						.then(function(user){
							return user;
						})
						.catch(function(err){
							$log.error(err);
							if(err.status && [404, 401, 403].indexOf(err.status)>-1)
								$log.info('No user to authenticate. Sign in first.');
							return;
						});	
				}]				
			},			  
		  views: {
		  	"@": {
		          templateUrl: 'views/boards.list.html',
		          controller: ['$Boards', '$log', 'FilterList', function($Boards, $log, FilterList){
		          
		          	this.list = [];
		          	this.filterList = FilterList;
		          	var self = this;
		          	
					$Boards.list()
					.then(function(data){
						self.list = data;
					})
		          	.catch(function(err){
		          		$log.error(err);
		          		throw err;
		          	});

		          }],
		          controllerAs: 'boardsVm'
		  	},
		  	"toolbar@": {
		          templateUrl: 'views/toolbar.html',
		          controller: ['FilterList', 'loggedUser', function(FilterList, loggedUser){
		          	this.filterList = FilterList;
		          	this.loggedUser = loggedUser;
		          }],
		          controllerAs: 'toolbarVm'
		  	}
		  }
		})
		.state('list.login', {
			url: "login",
			views: {
				"@": {
			    	template: '',
			        controller: ['$window', function($window){
			        	$window.location.href = CONFIG.LOGIN_URL;
					}],
			        controllerAs: 'loginVm'
				}
			}
		})		
		.state('list.entity', {
			url: "{boardId}",
			params: {
				board: undefined,
				timeline: false
			},
			resolve: {
				board: ['$state', '$stateParams', '$Boards', '$log', function($state, $stateParams, $Boards, $log){
					var boardId;
					if($stateParams.boardId !==undefined &&  $stateParams.boardId!==''){
						boardId = $stateParams.boardId;
					}
					if(boardId){
						if($stateParams.board)
							return $stateParams.board;
						else
							return $Boards.get(boardId)
							.catch(function(err){
								$log.error('Could not resolve board entity with id['+$stateParams.boardId+']');
								$state.go('list');
							});
					} else {
						return;
					}
				}]
			},
			views: {
				"@": {
					templateUrl: "views/board.html",
					controller: ['$state', '$stateParams', '$log', '$Boards', '$DBoardVisits', '$Tags', 'board', 'loggedUser', function($state, $stateParams, $log, $Boards, $DBoardVisits, $Tags, board, loggedUser){
						this.board = board;
						this.loggedUser = loggedUser;
						var self = this;
						
						try{
							$DBoardVisits.visit(this.board.id)
							.then(function(res){
								if(res!==false)
									self.board.visits++;
							});
						} catch(err){$log.error(err);}
						
						if($stateParams.timeline){
							$state.go('list.entity.discussion.timeline', {boardId: self.board.id, board:self.board, timeline:true}); 
						} else {
							$state.go('list.entity.discussion.thread', {boardId: self.board.id, board:self.board, timeline:false});  	
						}
						
						this.canVote = function(){
							return self.loggedUser!==undefined && !self.isAuthor() && !self.board.locked;
						};
						
						this.saveVote = function(vote){
							$Boards.saveVote(self.board, vote)
							.then(function(data){
								$log.info("voted: " + vote);
								self.board = data; 
							});
						};
						
						this.isAuthor = function(){
							return this.loggedUser!==undefined && this.loggedUser.username === this.board.user;
						};
						
						this.canPost = function(){
							return this.loggedUser!==undefined;
						};
						
						this.openBoardForEdit = function(){
							self.descriptionEdit = self.board.description;
						};
						
						this.postEdit = function(){
							self.board.description = self.descriptionEdit;
							$Boards.update(self.board)
							.then(function(board){
								self.board = board;
								delete self.descriptionEdit; 
							});
						};
						
						this.cancelEdit = function(){
							delete self.descriptionEdit;
						};
						
						this.toggleLock = function(){
							var op = self.board.locked?'unlock':'lock';
							$Boards[op].apply(self, [self.board])
							.then(function(){
								$stateParams.board = self.board;
								$state.go($state.$current, $stateParams);
							});
						};
						
						this.remove = function(){
							$Boards.remove(self.board)
							.then(function(){
								$state.go('list');
							});
						};
						
						this.tagAdded = function($tag){
							var tags = self.board.tags.map(function(tag){
								return tag.defaultLabel;
							});
							$Boards.setTags(self.board, tags);
						};
						
						this.tagRemoved = function($tag){
							var tags = self.board.tags.map(function(tag){
								return tag.defaultLabel;
							});
							$Boards.setTags(self.board, tags);
						};
						
						this.loadTags = function(query){
							return $Tags.query({"defaultLabel":query, "$filter":"defaultLabel"}).$promise
							.then(function(tags){
								return tags;
							});
						};

					}],
					controllerAs: 'boardVm'				
				}
			}
		})
		.state('list.entity.discussion', {
			abstract: true
		})
		.state('list.entity.discussion.thread', {
			url: "/thread",
			resolve: {
				comments: ['$Comments', 'board', function($Comments, board){
					return 	$Comments
							.list(board.id, 'thread')
							.then(function(comments){
								return comments;
							});
				}]
			},		
			views: {
				"@list.entity": {
					templateUrl: "views/discussion.thread.html",				
					controller: ['$state', '$log', '$Boards', '$Comments', 'board', 'comments', 'loggedUser', function($state, $log, $Boards, $Comments, board, comments, loggedUser){
						
						this.comment = {};
						this.comments = comments;
						this.board = board;
						this.loggedUser = loggedUser;
						var self = this;
					  	
					  	this.isAuthor = function(comment){
							return this.loggedUser!==undefined && this.loggedUser.username === comment.user;
						};
					  	
					  	this.canPost = function(){
					  		return self.loggedUser!==undefined && !self.board.locked;
					  	};
					  	
					  	this.openCommentForEdit = function(comment){
					  		self.comment = comment;
					  		self.commentEdit = true;
					  		if(self.replyEdit)
					  			self.replyCancel();
					  	};
					  	
					  	this.cancelCommentEdit = function(){
					  		self.comment = {};
					  		self.commentEdit = false;
					  	};
					  	
						this.postComment = function(){
							self.comment.boardId = this.board.id;
							var operation = self.comment.id!==undefined?'update':'save';
							$Comments[operation](self.comment)
							.then(function(commentData){
								//TODO: mixin into the resource the id from Location header upon response
								$log.info('Comment with id['+commentData.id+'] saved');
								$Boards.get(board.id)
								.then(function(board){
									$state.go('list.entity', {board: board}, {reload:true});
								});
							})
							.catch(function(err){
								$log.error(err);
								throw err;
							})
							.finally(function(){
								self.cancelCommentEdit();
							});
						};
						
						this.replyOpen = function(comment, reply){
							self.comment = comment;
							self.replyEdit = true;
							self.reply = reply || {
								replyToCommentId: comment.id,
								boardId: self.board.id
							};
						};

						this.replyCancel = function(){
							delete self.reply;
							self.replyEdit = false;
							if(!self.commentEdit && self.comment.id!==undefined)
								self.cancelCommentEdit();
						};

						this.replyPost = function(){
							var upsertOperation = self.reply.id===undefined?'save':'update';
							self.reply.replyToCommentId = self.comment.id;
							$Comments[upsertOperation](self.reply)
							.then(function(){
								$log.info('reply saved');
								$Boards.get(board.id)
								.then(function(board){
									$state.go('list.entity', {board: board}, {reload:true});
								});
							})
							.catch(function(err){
								throw err;
							})
							.finally(function(){
								self.replyCancel();
							});
						};
						
						this.remove = function(comment){
							$Comments.remove({commentId:comment.id})
							.then(function(){
								$Boards.get(board.id)
								.then(function(board){
									$state.go('list.entity', {board: board}, {reload:true});
								});
							})
							.catch(function(err){
								throw err;
							});
						};						

					}],
					controllerAs: 'vm'				
				}
			}
		})		
		.state('list.entity.discussion.timeline', {
			url: "/timeline",
			resolve: {
				comments: ['$Comments', 'board', function($Comments, board){
					return 	$Comments
							.list(board.id, 'timeline')
							.then(function(comments){
								return comments;
							});
				}]
			},
			views: {
				"@list.entity": {
					templateUrl: "views/discussion.timeline.html",				
					controller: ['$state', '$log', '$Boards', '$Comments', 'board', 'comments', 'loggedUser', function($state, $log, $Boards, $Comments, board, comments, loggedUser){
						
						this.comment = {};
						this.board = board;
						this.loggedUser = loggedUser;
						this.comments = comments;
						var self = this;
					  	
					  	this.isAuthor = function(comment){
							return this.loggedUser!==undefined && this.loggedUser.username === comment.user;
						};
						
					  	this.canPost = function(){
					  		return self.loggedUser!==undefined && !self.board.locked;
					  	};
					  	
					  	this.openCommentForEdit = function(comment){
					  		self.comment = comment;
					  		self.commentEdit = true;
					  	};
					  	
					  	this.cancelCommentEdit = function(){
					  		self.comment = {};
					  		self.commentEdit = false;
					  	};
					  	
						this.postComment = function(){
							self.comment.boardId = this.board.id;
							var operation = self.comment.id!==undefined?'update':'save';
							$Comments[operation](self.comment)
							.then(function(commentData){
								//TODO: mixin into the resource the id from Location header upon response
								$log.info('Comment with id['+commentData.id+'] saved');
								$Boards.get(board.id)
								.then(function(board){
									$state.go('list.entity', {board: board, timeline: true});
									//$state.go('list.entity.discussion.timeline', {board: board});
								});
							})
							.catch(function(err){
								$log.error(err);
								throw err;
							})
							.finally(function(){
								self.cancelCommentEdit();
							});
						};
												
						this.remove = function(comment){
							$Comments.remove({commentId:comment.id})
							.then(function(){
								$Boards.get(board.id)
								.then(function(board){
									$state.go('list.entity', {board: board}, {reload:true});
								});
							})
							.catch(function(err){
								throw err;
							});
						};						


					}],
					controllerAs: 'vm'				
				}
			}
		})		
		.state('list.new', { 		
			views: {
				"@": {
					templateUrl: "views/board.form.html",
					controller: ['$state', '$log', 'SecureBoard', 'loggedUser',  function($state, $log, SecureBoard, loggedUser){
							if(!loggedUser)
								$state.go('list.login');
							this.board = {};
					  		this.submit = function(){
					  			SecureBoard.save(this.board).$promise
					  			.then(function(data){
					  				$log.info('board with id['+data.id+'] saved');
		              				$state.go('list');
					  			})
					  			.catch(function(err){
					  				$log.error('board could not be saved');
					  				throw err;
					  			});
					  		};
						}],
					controllerAs: 'boardVm'								
				}
			}
		})
		.state('list.settings', {  
			views: {
				"@": {
					templateUrl: "views/settings.html",	
					controller: ['$state', 'FileUploader', 'loggedUser', function($state, FileUploader, loggedUser){
						this.user = loggedUser;
						this.rootPath = '../../js-secured/profile/avatar.js';
						var self  = this;
						
						var uploader = this.uploader = new FileUploader({
							url: this.user && this.rootPath
						});
					    this.uploader.onBeforeUploadItem = function(/*item*/) {
							//item.url = zipUploadPath + "?path=" + this.folder.path;
					    };
					    this.uploader.onCompleteItem = function(/*fileItem, response, status, headers*/) {
							$state.reload();
					    };
					    this.uploader.onAfterAddingFile = function(/*fileItem*/) {
					    	self.uploader.uploadAll();
					    };
					}],
					controllerAs: 'settingsVm'
				}
			}
		});
		  
		cfpLoadingBarProvider.includeSpinner = false;
		  
	}])
	.run(['$rootScope', '$location', '$LoggedUser', '$log', function ($rootScope, $location, $LoggedUser, $log) {
	    $rootScope.$on('$routeChangeStart', function (event) {
			$LoggedUser.get()
			.then(function(user){
		        if (!user) {
		            $log.error('DENY');
		            event.preventDefault();
		            $location.path(CONFIG.LOGIN_URL);
		        } else {
		            $log.info('ALLOW');
	//	            $location.path('/home');
		        }				
			});
	    });
	}]);
})(angular);
