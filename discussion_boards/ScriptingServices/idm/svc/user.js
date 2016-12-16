/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";
	
	var arester = require("arestme/arester");
	var userDAO = require("idm/lib/user_dao");
	
	var User = arester.asRestAPI(userDAO);
	User.prototype.logger.ctx = "User Svc";
	
	User.prototype.cfg[""].get = {
		handler: function(context, io){
			var self = this;
			var offset = context.queryParams.offset || 0;
			var limit = context.queryParams.limit || 100;
			var sort = context.queryParams.sort;
			var order = context.queryParams.order;			
			var expanded = context.queryParams.expanded;
			var username = context.queryParams.username;
			
		    try{
				var entities = this.dao.list.apply(self, [limit, offset, sort, order, expanded, username]);
		        var jsonResponse = JSON.stringify(entities, null, 2);
		    	io.response.println(jsonResponse);
			} catch(e) {
	    	    var errorCode = io.response.INTERNAL_SERVER_ERROR ;
	    	    self.logger.error(errorCode, e.message, e.errContext);
	        	self.sendError(io, errorCode, errorCode, e.message, e.errContext);
	        	throw e;
			}			
		}
	};
		
	var user = new User(userDAO);
	
	(function(user) {

		var request = require("net/http/request");
		var response = require("net/http/response");
		
		user.service(request, response);
		
	})(user);
	
})();
