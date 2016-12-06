(function(angular){
"use strict";

//angular'ized extenral dependencies
angular.module('$moment', [])
.factory('$moment', ['$window', function($window) {
  return $window.moment;
}]);

angular.module('discussion-boards', ['$moment', 'ngAnimate', 'ngResource', 'ui.router', 'ui.bootstrap', 'angular-loading-bar'])
.config(['$stateProvider', '$urlRouterProvider', 'cfpLoadingBarProvider', function($stateProvider, $urlRouterProvider, cfpLoadingBarProvider) {

		$urlRouterProvider.otherwise("/");
		
		$stateProvider	
		.state('list', {
			  url: "/",
		      views: {
		      	"@": {
		              templateUrl: 'views/master.html',
		              controller: ['MasterDataService', '$log', 'FilterList', function(MasterDataService, $log, FilterList){
		              
		              	this.list = [];
		              	this.filterList = FilterList;
		              	var self = this;
		              	
						MasterDataService.list()
						.then(function(data){
							self.list = data;
						})
		              	.catch(function(err){
		              		$log.error(err);
		              		throw err;
		              	});
		              	
						this.saveVote = function(vote){
							MasterDataService.saveVote(self.board, vote)
							.then(function(data){
								$log.info("voted: " + vote);
								self.board = data;
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
				board: ['$stateParams', 'MasterDataService', function($stateParams, MasterDataService){
					if($stateParams.boardId && $stateParams.board){
						return $stateParams.board;
					} else {
						return MasterDataService.get($stateParams.boardId)
						.then(function(data){
							return data;
						});
					}
				}]
			},
			views: {
				"@": {
					templateUrl: "views/detail.html",				
					controller: ['$state', '$log', 'MasterDataService', 'board', function($state, $log, MasterDataService, board){
						this.board = board;
						var self = this;
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
		.state('list.entity.edit', {    
			views: {
				"@": {
					templateUrl: "views/board.upsert.html",
					controller: ['$state', '$stateParams', '$log', 'MasterDataService', 'Board', function($state, $stateParams, $log, MasterDataService, Board){
							this.board;
							var self = this;
							if($stateParams.boardId!==undefined){
							  	if($stateParams.board)
									this.board = $stateParams.board;
								else {
									MasterDataService.get($stateParams.boardId)
									.then(function(data){
										self.board = data;
									});								
								}
							}
					  		this.submit = function(){
					  			var upsertOperation = self.board.disb_id===undefined?'save':'update';
					  			Board[upsertOperation](this.board).$promise
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
		});
		  
		cfpLoadingBarProvider.includeSpinner = false;
		  
	}])
	.service('FilterList', [function() {
		var _filterText;
	  	return {
	  		filterText: _filterText
	  	};
	}])
})(angular);
