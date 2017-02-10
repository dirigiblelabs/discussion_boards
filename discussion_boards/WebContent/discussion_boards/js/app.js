(function(angular){
"use strict";

//angular'ized external dependencies
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
						if($stateParams.board){
							return $stateParams.board;
						} else
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
					controller: ['$state', '$stateParams', '$log', '$Boards', '$Tags', 'board', 'loggedUser', '$rootScope', function($state, $stateParams, $log, $Boards, $Tags, board, loggedUser, $rootScope){
						this.board = board;
						this.commentsCount = board.commentsCount;
						this.loggedUser = loggedUser;
						var self = this;
						
						$rootScope.$on('dboards.comments.save', 
										function(evt){
											self.commentsCount++;
											evt.preventDefault();
										});
						$rootScope.$on('dboards.comments.remove', 
										function(evt, comment){
											self.commentsCount--;
											if(comment.replies)
												self.commentsCount = self.commentsCount - comment.replies.length;
											evt.preventDefault();
										});						
						$Boards.visit(this.board);
						
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
					controller: ['$log', '$Comments', 'board', 'comments', 'loggedUser', function($log, $Comments, board, comments, loggedUser){
						
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
							var operation = self.comment.id!==undefined?'update':'save';
							if(operation==='save'){
								self.comment.boardId = this.board.id;
								self.comments.push(self.comment);
							}
							var comment = self.comment;
							self.cancelCommentEdit();self.commentEdit = true;
							$Comments[operation](comment)
							.then(function(commentData){
								$log.info('Comment['+commentData.id+'] ' + operation + 'd');
								$Comments.list(self.board.id, 'thread')
								.then(function(comments){
									self.comments = comments;
								})
								.finally(function(){
									self.commentEdit = false;
								});								
							})
							.catch(function(err){
								$log.error(err);
								self.comments.filter(function(com){
									return com.id === comment;
								});
								self.commentEdit = false;
								throw err;
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
							var operation = self.reply.id===undefined?'save':'update';
							if(operation === 'save'){
								self.reply.replyToCommentId = self.comment.id;							
								self.comment.replies.push(self.reply);
							}
							var reply = self.reply;
							this.replyCancel();self.replyEdit = true;self.commentEdit = true;
							$Comments[operation](reply)
							.then(function(replyData){
								$log.info('Reply['+replyData.id+'] to comment['+self.comment.id+'] ' + operation + 'd');
								$Comments.list(self.board.id, 'thread')
								.then(function(comments){
									self.comments = comments;
								})
								.finally(function(){
									self.replyEdit = false;
									self.commentEdit = false;
								});
							})
							.catch(function(err){
								self.replyEdit = false;
								self.commentEdit = false;
								throw err;
							});
						};
						
						this.remove = function(comment){
							this.comments = this.comments.filter(function(com, idx){
								if(com.id === comment.id){
									return false;
								} else {
									self.comments[idx].replies = self.comments[idx].replies.filter(function(_com){
										if(_com.id === comment.id){
											return false;
										}
										return true;
									});
									return true;
								}
							});							
							$Comments.remove(comment)
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
							if(operation==='save')
								self.comments.push(self.comment);
							$Comments[operation](self.comment)
							.then(function(commentData){
								$log.info('Comment['+commentData.id+'] ' + operation + 'd');
								$Comments.list(self.board.id, 'thread')
								.then(function(comments){
									self.comments = comments;
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
		  
	}]);
})(angular);
