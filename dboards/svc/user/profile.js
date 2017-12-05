/* globals $ */
/* eslint-env node, dirigible */
"use strict";

require('http/v3/rs')
.service()
	.resource("logout")
		.get(function(context, request, response){
				require('http/v3/session').invalidate();
				response.setStatus(response.OK);
			})
.execute();
