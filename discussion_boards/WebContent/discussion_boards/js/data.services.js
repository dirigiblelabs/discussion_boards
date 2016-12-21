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
	.service('LoggedUser', ['$resource', '$log', function($resource) {
		var UserSvc =  $resource('../../js/idm/svc/user.js/$current', {}, 
	  					{get: {method:'GET', params:{}, isArray:false, ignoreLoadingBar: true}});
	  	var get = function(){
		  	return UserSvc.get().$promise
		  	.then(function(userData){
		  		return userData;
		  	});
	  	};
	  	return {
	  		get: get
	  	};
	}])
	.service('User', ['$resource', '$log', function($resource) {
		var UserSvc = $resource('../../js/idm/svc/user.js/$pics/:userName', {}, 
	  					{get: {method:'GET', params:{}, isArray:false, ignoreLoadingBar: true}});
		var get = function(userName){
		  	return UserSvc.get({"userName":userName}).$promise
		  	.then(function(userData){
		  		return userData;
		  	});
	  	};	  					
	  	return {
	  		get: get
	  	};	  					
	}])	
/*	.service('User', ['$resource', '$log', function($resource, $log) {
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
	}])	*/
	.service('MasterDataService', ['Board', 'BoardVote', '$moment', function(Board, BoardVote, $moment) {
		
		function asElapsedTimeString(time){
			if(time)
				return $moment(new Date(time).toISOString()).fromNow();
		}
		
		function formatNumberShort(value){
			if(value === undefined || Number.isNaN(value))
				return value;
			var val = parseInt(value);
			if(val > 1000000){
				val = Math.round((val/1000000)*100)/100;
				return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")+"M+";
			}
			if(val>1000){
				val = Math.round((val/1000)*100)/100;
				return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")+"K+";
			}
			if(val > 200){
				return Math.floor(100/100)*100 + '+';
			}
			return val;
		}
		
		function formatEntity(board){
			board.timeSincePublish = asElapsedTimeString(board.publishTime);
			board.publishTimeLocal = $moment(board.publishTime).format('LLL');
			board.lastModifiedTimeLocal = $moment(board.lastModifiedTime).format('LLL');
  			if($moment(board.lastModifiedTime).isAfter($moment(board.publishTime))){
  				board.timeSinceLastModified = asElapsedTimeString(board.lastModifiedTime);			
  			}
			if(board.latestDiscussionUpdateTime){
				board.latestDiscussionUpdateTimeLocal = $moment(board.latestDiscussionUpdateTime).format('LLL');  	
  				board.timeSinceLatestDiscussionUpdateTime = asElapsedTimeString(board.latestDiscussionUpdateTime); 
  			}
  			
  			if(board.comments){
          		board.comments = board.comments.map(function(comment){
	      			comment.timeSincePublish = asElapsedTimeString(comment.publishTime);
					comment.publishTimeLocal = $moment(comment.publishTime).format('LLL'); 	      			
	      			if($moment(comment.lastModifiedTime).isAfter($moment(comment.publishTime))){
	      				comment.lastModifiedTimeLocal = $moment(comment.lastModifiedTime).format('LLL');
	      				comment.timeSinceLastModified = asElapsedTimeString(comment.lastModifiedTime);
      				}
	      			if(comment.replies){
	      				comment.replies = comment.replies.map(function(reply){
	          				reply.timeSincePublish = asElapsedTimeString(reply.publishTime);
	          				reply.publishTimeLocal = $moment(reply.publishTime).format('LLL');
	          				if($moment(reply.lastModifiedTime).isAfter($moment(reply.publishTime))){
	      						reply.lastModifiedTime = asElapsedTimeString(reply.lastModifiedTime);
	          					reply.lastModifiedTimeLocal = $moment(reply.lastModifiedTime).format('LLL');	      						
      						}
	          				return reply;
	          			});
	            	}
	            	return comment;
				});
  			}
  			
  			board.visitsShort = formatNumberShort(board.visits);
  			board.participantsCountShort = formatNumberShort(board.participantsCount);
			board.totalVotesShort = formatNumberShort(board.totalVotes);
			board.upvotesShort = formatNumberShort(board.upvotes);
			board.downvotesShort = formatNumberShort(board.downvotes);			
			board.ratingShort = formatNumberShort(board.rating);
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
