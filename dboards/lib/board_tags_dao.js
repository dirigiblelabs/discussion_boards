/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";

var BoardTagsORM = {
	table: 'DIS_BOARD_TAG',
	properties: [{
			name: "id",
			column: "DISBT_ID",
			id: true,
			required: true,
			type: "BIGINT"
		},{
			name: "boardId",
			column: "DISBT_DISB_ID",
			id: true,
			required: true,
			type: "BIGINT"
		},{
			name: "tagId",
			column: "DISBT_ANN_ID",
			id: true,
			required: true,
			type: "BIGINT"
		}],
	associations: [{
			name: 'board',
			targetDao: require("dboards/lib/board_dao").create,
			type: 'many-to-one',
			joinKey: "boardId"
		},{
			name: 'tags',
			targetDao: require("tags/lib/tags_dao").create,
			type: 'many-to-one',
			joinKey: "tagId"
		}]	
};

var DAO = require('db/v3/dao').DAO;
var BoardTagDAO  = exports.BoardTagDAO = function(orm, boardDao, tagsDao){
	orm = orm || BoardTagsORM;
	DAO.call(this, orm, 'BoardTagDAO');
	this.boardDao = boardDao;
	this.tagsDao = tagsDao;
};
BoardTagDAO.prototype = Object.create(DAO.prototype);

BoardTagDAO.prototype.listJoins = function(settings, daos){
	var boardId;
	if(typeof settings === 'string'){
		boardId = settings;
	} else if(typeof settings === 'object'){
		boardId = settings.boardId;
	}

	this.$log.info('Finding '+daos.targetDao.orm.table+' entities related to '+daos.sourceDao.orm.table+'['+boardId+']');

	if(boardId === undefined || boardId === null){
		throw new Error('Illegal argument for id parameter:' + boardId);
	}
    
	var qb;
	try{
		qb= require('db/v3/sql').getDialect()
		.select()
		.from(daos.targetDao.orm.table)
		.leftJoin(daos.joinDao.orm.table, daos.joinDao.orm.getProperty('tagId').column+"="+daos.targetDao.orm.getPrimaryKey().column)
		.where(daos.joinDao.orm.getProperty('boardId').column+"=?", [daos.joinDao.orm.getProperty('tagId')]);
		var parameterBindings = {};
		parameterBindings[daos.joinDao.orm.getProperty('tagId').name] = boardId;
	
		var resultSet = this.execute(qb, parameterBindings);
		
	    var tagEntities = [];
	    resultSet.forEach(function(rsEntry){
      		var tagEntity = {
	    		id: rsEntry['get'+daos.targetDao.orm.getPrimaryKey().type](daos.targetDao.orm.getPrimaryKey().column),
	    		defaultLabel: rsEntry['get'+daos.targetDao.orm.getProperty('defaultLabel').type](daos.targetDao.orm.getProperty('defaultLabel').column),
			    uri: rsEntry['get'+daos.targetDao.orm.getProperty('uri').type](daos.targetDao.orm.getProperty('uri').column)
	    	};
	    	tagEntities.push(tagEntity);
  		});
	    this.$log.info(tagEntities.length+' '+daos.targetDao.orm.table+' entities related to '+daos.sourceDao.orm.table+'[' + boardId+ '] found');
	} catch (err){
    	this.$log.error('Listing {} entities related to {}[{}] failed', daos.targetDao.orm.table, daos.sourceDao.orm.table, boardId);
    	throw err;
	}
    return tagEntities;
};

exports.create = function(boardDao, tagsDao){
	var boardTagDAO = new BoardTagDAO(BoardTagsORM, boardDao, tagsDao);
	return boardTagDAO;
};
})();
