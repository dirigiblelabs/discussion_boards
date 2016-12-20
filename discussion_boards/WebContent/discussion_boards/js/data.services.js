(function(angular){
"use strict";

	angular.module('discussion-boards')
	.service('Board', ['$resource', '$log', function($resource, $log) {
	  	return $resource('../../js/discussion_boards/svc/board.js/:boardId', { boardId:'@disb_id' }, {
			    save: {
			        method: 'POST',
			        interceptor: {
		                response: function(res) {
		                	var location = res.headers('Location');
		                	if(location){
		                		var id = location.substring(location.lastIndexOf('/')+1);
		                		angular.extend(res.resource, { "disb_id": id });
	                		} else {
	                			$log.error('Cannot infer id after save operation. HTTP Response Header "Location" is missing: ' + location);
	            			}
	                        return res.resource;
		                }
		            }, 
		            isArray: false
			    },
			    update: {
			        method: 'PUT'
			    }
			});
	}])
	.service('BoardCount', ['$resource', function($resource) {
	  	return $resource('../../js/discussion_boards/svc/board.js/count', {}, 
	  			{get: {method:'GET', params:{}, isArray:false, ignoreLoadingBar: true}});
	}])	
	.service('BoardVote', ['$resource', function($resource) {
	  	return $resource('../../js/discussion_boards/svc/board.js/:boardId/vote', {}, 
	  			{get: {method:'GET', params:{}, isArray:false, ignoreLoadingBar: true}},
	  			{save: {method:'POST', params:{}, isArray:false, ignoreLoadingBar: true}});
	}])	
	.service('BoardVisits', ['$resource', function($resource) {
	  	return $resource('../../js/discussion_boards/svc/board.js/:boardId/visit', {}, 
	  			{update: {method:'PUT', params:{}, isArray:false, ignoreLoadingBar: true}});
	}])		
	.service('Comment', ['$resource', '$log', function($resource, $log) {
	 	return $resource('../../js/discussion_boards/svc/comment.js/:commentId', { commentId:'@disc_id' }, {
			    save: {
			        method: 'POST',
			        interceptor: {
		                response: function(res) {
		                	var location = res.headers('Location');
		                	if(location){
		                		var id = location.substring(location.lastIndexOf('/')+1);
		                		angular.extend(res.resource, { "disc_id": id });
	                		} else {
	                			$log.error('Cannot infer id after save operation. HTTP Response Header "Location" is missing: ' + location);
	            			}
	                        return res.resource;
		                }
		            }, 
		            isArray: false
			    },
			    update: {
			        method: 'PUT'
			    }
			});
	}])
	.service('User', ['$resource', '$log', function($resource, $log) {
	  	return $resource('../../js/idm/svc/user.js/:userId', { userId:'@idmu_id' }, {
			    save: {
			        method: 'POST',
			        interceptor: {
		                response: function(res) {
		                	var location = res.headers('Location');
		                	if(location){
		                		var id = location.substring(location.lastIndexOf('/')+1);
		                		angular.extend(res.resource, { "idmu_id": id });
	                		} else {
	                			$log.error('Cannot infer id after save operation. HTTP Response Header "Location" is missing: ' + location);
	            			}
	                        return res.resource;
		                }
		            }, 
		            isArray: false
			    },
			    update: {
			        method: 'PUT'
			    }
			});
	}])	
	.service('MasterDataService', ['Board', 'BoardVote', '$moment', function(Board, BoardVote, $moment) {
		
		function asElapsedTimeString(time){
			if(time)
				return $moment(new Date(time).toISOString()).fromNow();
		}
		
		function formatEntity(board){
			board.timeSincePublish = asElapsedTimeString(board.publishTime);
  			if(board.lastModifiedTime && $moment(board.lastModifiedTime).isAfter($moment(board.publishTime)))
  				board.timeSinceLastModified = asElapsedTimeString(board.lastModifiedTime);
			if(board.latestDiscussionUpdateTime)
  				board.timeSinceLatestDiscussionUpdateTime = asElapsedTimeString(board.latestDiscussionUpdateTime);  				
  				
  			if(board.comments){
          		board.comments = board.comments.map(function(comment){
	      			comment.timeSincePublish = asElapsedTimeString(comment.publishTime);
	      			if(comment.lastModifiedTime && $moment(comment.lastModifiedTime).isAfter($moment(comment.publishTime)))
	      				comment.timeSinceLastModified = asElapsedTimeString(comment.lastModifiedTime);
	      			if(comment.replies){
	      				comment.replies = comment.replies.map(function(reply){
	          				reply.timeSincePublish = asElapsedTimeString(reply.publishTime);
	          				if(reply.lastModifiedTime && $moment(reply.lastModifiedTime).isAfter($moment(reply.publishTime)))
	      						reply.lastModifiedTime = asElapsedTimeString(reply.lastModifiedTime);
	          				return reply;
	          			});
	            	}
	            	return comment;
				});
  			}
  			board.picSrc = board.user_pic&&board.user_pic!=="-1"?"data:image/png;base64,"+board.user_pic:undefined;
  			return board;
		}
		
		var list = function(){
			return Board.query({expanded:true}).$promise
          	.then(function(data){
          		return data.map(function(board){
          			return formatEntity(board);
          		});
          	});
		};
		var get = function(boardId){
			return Board.get({"boardId": boardId, "expanded":true}).$promise
			.then(function(board){
	      		return formatEntity(board);
			});
		};
		var update = function(board){
			return Board.update(board).$promise
			.then(function(board){
	      		return formatEntity(board);
			});
		};	
		var saveVote = function(board, v){
			return BoardVote.save({"boardId": board.disb_id}, {"vote":v}).$promise
			.then(function(){
	      		return get(board.disb_id);
			});
		};
		var getVote = function(board){
			return BoardVote.get({"boardId":board.disb_id}).$promise
			.then(function(vote){
	      		return vote;
			});
		};
	 	return {
	 		list: list,
	 		get :get,
	 		update: update,
	 		getVote: getVote,
	 		saveVote: saveVote
	 	};
	}]);
})(angular);
