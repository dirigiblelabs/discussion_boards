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


angular.module('discussion-boards', ['$moment', '$ckeditor', 'ngSanitize', 'ngAnimate', 'ngResource', 'ui.router', 'ui.bootstrap', 'angular-loading-bar', 'angularFileUpload'])
.config(['$stateProvider', '$urlRouterProvider', 'cfpLoadingBarProvider', function($stateProvider, $urlRouterProvider, cfpLoadingBarProvider) {

		$urlRouterProvider.otherwise("/");
		
		$stateProvider	
		.state('list', {
			  url: "/",
		      views: {
		      	"@": {
		              templateUrl: 'views/master.html',
		              controller: ['MasterDataService', '$log', 'FilterList', 'User', function(MasterDataService, $log, FilterList, User){
		              
		              	this.list = [];
		              	this.filterList = FilterList;
		              	var self = this;
		              	
		              	this.getUserDetails = function(_username){
		              		return User.query({username:_username}).$promise
		              	};
		              	
						MasterDataService.list()
						.then(function(data){
							self.list = data;
						})
		              	.catch(function(err){
		              		$log.error(err);
		              		throw err;
		              	});
		              	
						this.saveVote = function(board, vote){
							MasterDataService.saveVote(board, vote)
							.then(function(data){
								$log.info("voted: " + vote);
								self.list = self.list.map(function(b){
									if(b.disb_id === data.disb_id)
										return data;
									else
										return b;
								});
							});
						};
						
		              }],
		              controllerAs: 'masterVm'
		      	},
		      	"toolbar@": {
		              templateUrl: 'views/toolbar.html',
		              controller: ['FilterList', function(FilterList){
		              	this.filterList = FilterList;
		              }],
		              controllerAs: 'toolbarVm'
		      	}
		      }
		    })
		.state('list.entity', {
			url: "{boardId}",
			params: {
				board: undefined
			},
			resolve: {
				board: ['$state', '$stateParams', 'MasterDataService', '$log', function($state, $stateParams, MasterDataService, $log){
					var boardId;
					if($stateParams.boardId !==undefined &&  $stateParams.boardId!==''){
						boardId = $stateParams.boardId;
					}
					if(boardId){
						if($stateParams.board)
							return $stateParams.board;
						else
							return MasterDataService.get(boardId)
							.then(function(data){
								return data;
							})
							.catch(function(err){
								$log('Could not resolveboard entity with id['+$stateParams.boardId+']');
								$state.go('list');
							});
					} else {
						return;
					}
				}]
			},
			views: {
				"@": {
					templateUrl: "views/detail.html",				
					controller: ['$state', '$log', 'MasterDataService', 'DBoardVisits', 'board', function($state, $log, MasterDataService, DBoardVisits, board){
						this.board = board;
						var self = this;
						
						try{
							DBoardVisits.visit(this.board.disb_id)
							.then(function(res){
								if(res!==false)
									self.board.visits++;
							});
						} catch(err){$log.error(err);}
						
						$state.go('list.entity.discussion', {boardId: self.board.disb_id, board:self.board});  	
						
						this.saveVote = function(vote){
							MasterDataService.saveVote(self.board, vote)
							.then(function(data){
								$log.info("voted: " + vote);
								self.board = data; 
							});
						};
						
						this.getVote = function(){
							MasterDataService.getVote(self.board)
							.then(function(vote){
								self.currentUserVote = vote;
							});
						};
						
						this.openBoardForEdit = function(){
							self.descriptionEdit = self.board.description;
						};
						
						this.postEdit = function(){
							self.board.description = self.descriptionEdit;
							MasterDataService.update(self.board)
							.then(function(board){
								self.board = board;
								delete self.descriptionEdit; 
							});
						};
						
						this.cancelEdit = function(){
							delete self.descriptionEdit;
						};

					}],
					controllerAs: 'detailsVm'				
				}
			}
		})
		.state('list.entity.discussion', {
			views: {
				"@list.entity": {
					templateUrl: "views/discussion.html",				
					controller: ['$stateParams','$log', 'MasterDataService', 'Comment', 'board', function($stateParams, $log, MasterDataService, Comment, board){
						
						this.comment = {};
						this.board = board;
						var self = this;
					  	
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
							self.comment.disc_disb_id = this.board.disb_id;
							var operation = self.comment.disc_id!==undefined?'update':'save';
							Comment[operation](self.comment).$promise
							.then(function(commentData){
								//TODO: mixin into the resource the id from Location header upon response
								$log.info('Comment with id['+commentData.disc_id+'] saved');
								return MasterDataService.get($stateParams.boardId)
										.then(function(data){
											self.board = data;
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
								reply_to_disc_id: comment.disc_id,
								disc_disb_id: self.board.disb_id
							};
						};

						this.replyCancel = function(){
							delete self.reply;
							self.replyEdit = false;
							if(!self.commentEdit && self.comment.disc_id!==undefined)
								self.cancelCommentEdit();
						};

						this.replyPost = function(){
							var upsertOperation = self.reply.disc_id===undefined?'save':'update';
							Comment[upsertOperation ](self.reply).$promise
							.then(function(commentData){
								$log.info('reply saved');
								return MasterDataService.get($stateParams.boardId)
										.then(function(data){
											self.board = data;
										});
							})
							.catch(function(err){
								throw err;
							})
							.finally(function(){
								self.replyCancel();
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
					templateUrl: "views/board.upsert.html",
					controller: ['$state', '$log', 'Board',  function($state, $log, Board){
							this.board = {};
							var self = this;
					  		this.submit = function(){
					  			Board.save(this.board).$promise
					  			.then(function(data){
					  				$log.info('board with id['+data.disb_id+'] saved');
		              				$state.go('list');
					  			})
					  			.catch(function(err){
					  				$log.error('board could not be saved');
					  				throw err;
					  			});
					  		};
						}],
					controllerAs: 'detailsVm'								
				}
			}
		})
		.state('list.settings', {    
			views: {
				"@": {
					templateUrl: "views/settings.html",	
					controller: [function(){
						console.info("todo");
					}]
				}
			}
		});
		  
		cfpLoadingBarProvider.includeSpinner = false;
		  
	}])
	.service('DBoardVisits', ['BoardVisits', '$q', function(BoardVisits, $q) {
		var visited = [];
		var put = function(disb_id){
			if(visited.indexOf(disb_id)<0){
				visited.push(disb_id);
				return BoardVisits.update({"boardId": disb_id}, {}).$promise;
			} else {
				return $q.when(false);
			}
		};
	  	return {
	  		visit: put
	  	};
	}])	
	.service('FilterList', [function() {
		var _filterText;
	  	return {
	  		filterText: _filterText
	  	};
	}])
	.directive('ckEditor', ['$ckeditor', function($ckeditor) {
	  return {
	    require: '?ngModel',
	    link: function(scope, elm, attr, ngModel) {
	    
	      var ck = $ckeditor.replace(elm[0], {
		    	toolbar: [
					{ name: 'clipboard', groups: [ 'clipboard', 'undo' ], items: [ 'Cut', 'Copy', 'Paste', 'Undo', 'Redo' ] },
					{ name: 'editing', groups: [ 'find', 'selection', 'spellchecker' ], items: [ 'Scayt' ] },
					{ name: 'links', items: [ 'Link', 'Unlink', 'Anchor' ] },
					{ name: 'insert', items: [ 'Image', 'Table', 'HorizontalRule', 'SpecialChar' ] },
					{ name: 'document', groups: [ 'mode', 'document', 'doctools' ], items: [ 'Source' ] },
					{ name: 'basicstyles', groups: [ 'basicstyles', 'cleanup' ], items: [ 'Bold', 'Italic', 'Strike', '-', 'RemoveFormat' ] },
					{ name: 'paragraph', groups: [ 'list', 'indent', 'blocks', 'align', 'bidi' ], items: [ 'NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote' ] },
					{ name: 'styles', items: [ 'Styles', 'Format' ] }
				],
				toolbarGroups: [
					{ name: 'clipboard', groups: [ 'clipboard', 'undo' ] },
					{ name: 'editing', groups: [ 'find', 'selection', 'spellchecker' ] },
					{ name: 'links' },
					{ name: 'insert' },
					{ name: 'forms' },
					{ name: 'tools' },
					{ name: 'document', groups: [ 'mode', 'document', 'doctools' ] },
					{ name: 'others' },
					'/',
					{ name: 'basicstyles', groups: [ 'basicstyles', 'cleanup' ] },
					{ name: 'paragraph', groups: [ 'list', 'indent', 'blocks', 'align', 'bidi' ] },
					{ name: 'styles' },
					{ name: 'colors' }
				]				
	    	});
	
	      if (!ngModel) return;
	
	      ck.on('pasteState', function() {
	        scope.$apply(function() {
	          ngModel.$setViewValue(ck.getData());
	        });
	      });
	
	      ngModel.$render = function(value) {
	        ck.setData(ngModel.$viewValue);
	      };
	    }
	  };
	}]);
})(angular);
