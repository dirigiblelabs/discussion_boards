/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";
	
	var arester = require("arestme/arester");
	var tagsDAO = require("annotations/lib/tags_dao");
	
	var Tag = arester.asRestAPI(tagsDAO);
	Tag.prototype.logger.ctx = "Tags Svc";
		
	var tag = new Tag(tagsDAO);	

	var request = require("net/http/request");
	var response = require("net/http/response");
	
	tag.service(request, response);
		
})();
