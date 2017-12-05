/* globals $ */
/* eslint-env node, dirigible */
"use strict";

var comments = require("dboards/lib/comments_service_lib").create();
comments.mappings().readonly();
comments.execute();
