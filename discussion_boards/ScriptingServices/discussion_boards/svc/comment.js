/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";
	
	var arester = require("arestme/arester");
	var commentDAO = require("discussion_boards/lib/comment_dao");
	
	var Comment = arester.asRestAPI(commentDAO);
	Comment.prototype.logger.ctx = "Comment Svc";
	
	//override default GET list operation handler for this resource
	Comment.prototype.cfg[""].get.handler = function(context, io){
		var boardId = context.pathParams.id;	//?
		var limit = context.queryParams.limit;	
		var offset = context.queryParams.offset;
		var sort = context.queryParams.sort;
		var order = context.queryParams.order;
		var expanded = context.queryParams.expanded;
	    try{
			var items = this.dao.list(boardId, limit, offset, sort, order, expanded);
	        var jsonResponse = JSON.stringify(items, null, 2);
	    	io.response.println(jsonResponse);
		} catch(e) {
    	    var errorCode = io.response.INTERNAL_SERVER_ERROR ;
    	    this.logger.error(errorCode, e.message, e.errContext);					
        	this.sendError(io, errorCode, errorCode, e.message, e.errContext);
        	throw e;
		}
	};
	
	Comment.prototype.cfg["{id}"].put.handler = function(context, io){
		//TODO: use isUserInRole to check privileges
	    try{
			Comment.prototype.cfg["{id}"].put.handler.apply(this, [context, io]);
		} catch(e) {
    	    var errorCode = io.response.INTERNAL_SERVER_ERROR ;
    	    this.logger.error(errorCode, e.message, e.errContext);					
        	this.sendError(io, errorCode, errorCode, e.message, e.errContext);
        	throw e;
		}
	};	
	
	
	var comment = new Comment(commentDAO);	
	
	(function(comment) {

		var request = require("net/http/request");
		var response = require("net/http/response");
		
		comment.service(request, response);
		
	})(comment);	
	
})();
