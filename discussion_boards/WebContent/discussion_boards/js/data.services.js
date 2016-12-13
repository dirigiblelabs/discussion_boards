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
	.service('MasterDataService', ['Board', 'BoardVote', '$moment', function(Board, BoardVote, $moment) {
		
		function formatEntity(board){
			board.timeSincePublish = $moment(board.publishDate).fromNow();
  			if(board.latestPublishDate)
  				board.timeSinceLatestPublish = $moment(board.latestPublishDate).fromNow();
  			if(board.comments){
          		board.comments = board.comments.map(function(comment){
	      			comment.timeSincePublish = $moment(comment.publish_date).fromNow();
	      			if(comment.replies){
	      				comment.replies = comment.replies.map(function(reply){
	          				reply.timeSincePublish = $moment(reply.publish_date).fromNow();
	          				return reply;
	          			});
	            	}
	            	return comment;
				});
  			}
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
	 		get:get,
	 		getVote: getVote,
	 		saveVote: saveVote
	 	};
	}]);
})(angular);
