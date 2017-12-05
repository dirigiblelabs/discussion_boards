/* globals $ */
/* eslint-env node, dirigible */
"use strict";

/*The board.js service for annonymous access*/
var visitCfg = require("dboards/lib/boards_service_lib").create().mappings().find("{id}/visit", "put", ['application/json'], undefined).configuration();
var svc = require("dboards/lib/board_stats_service_lib").create();
svc.resource("{id}/visit").put(visitCfg);
svc.execute();