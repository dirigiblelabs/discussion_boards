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
	.service('$Comment', ['$resource', '$log', function($resource, $log) {
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
	.service('$LoggedUser', ['$resource', '$log', function($resource) {
		var UserSvc =  $resource('../../js/idm/svc/user.js/$current', {}, 
	  					{get: {method:'GET', params:{}, isArray:false, ignoreLoadingBar: true}});
	  	var get = function(){
		  	return UserSvc.get().$promise;
	  	};
	  	return {
	  		get: get
	  	};
	}])
	.service('$UserImg', ['$resource', '$log', function($resource) {
		var UserSvc = $resource('../../js/idm/svc/user.js/$pics/:userName', {}, 
	  					{get: {method:'GET', params:{}, isArray:false, cache: true, ignoreLoadingBar: true}});
		var get = function(userName){
		  	return UserSvc.get({"userName":userName}).$promise
		  	.then(function(userData){
		  		return userData;
		  	});
	  	};	  					
	  	return {
	  		get: get
	  	};	  					
	}]);
})(angular);
