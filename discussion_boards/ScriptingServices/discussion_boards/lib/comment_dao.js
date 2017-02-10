/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";

var CommentsORM = {
	dbName: "DIS_COMMENT",
	properties: [
		{
			name: "id",
			dbName: "DISC_ID",
			id: true,
			required: true,
			type: "Long"
		},{
			name: "boardId",
			dbName: "DISC_DISB_ID",
			required: true,
			type: "Long"
		},{
			name: "replyToCommentId",
			dbName: "DISC_REPLY_TO_DISC_ID",
			type: "Long",
			dbValue: function(entity){
				return entity.replyToCommentId !==undefined ? entity.replyToCommentId : null;//TODO: Fixme as soon as all -1 entries are updated to null. Will work with null isntead of -1
			},
			value: function(dbValue){
				return dbValue === null || dbValue<1 ? undefined : dbValue;//TODO: Fixme as soon as all -1 entries are updated to null. Will work with null isntead of -1
			},
		},{
			name: "text",
			dbName: "DISC_COMMENT_TEXT",
			type: "String",
			size: 10000
		},{
			name: "publishTime",
			dbName: "DISC_PUBLISH_TIME",
			required: true,
			type: "Long",
			dbValue: function(entity){
				return entity.publishTime !== undefined ? new Date(entity.publishTime).getTime() : null;
			},
			value: function(dbValue){
				return dbValue !== null ? new Date(dbValue).toISOString() : undefined;
			},
			allowedOps: ['insert']
		},{
			name: "lastModifiedTime",
			dbName: "DISC_LASTMODIFIED_TIME",
			type: "Long",
			dbValue: function(entity){
				return entity.lastModifiedTime !== undefined ? new Date(entity.lastModifiedTime).getTime() : null;
			},
			value: function(dbValue){
				return dbValue !== null ? new Date(dbValue).toISOString() : undefined;
			}
		},{
			name: "user",
			dbName: "DISC_USER",
			type: "String",
			size: 100,
			dbValue: function(entity){
				return require("net/http/user").getName();
			}
		}	
	],
	associationSets: {
		replies: {
			joinKey: "replyToCommentId",
			associationType: 'one-to-many',
			defaults: {
				flat:true
			}
		},
		board: {
			dao: require("discussion_boards/lib/board_dao").get,
			associationType: 'many-to-one',
			joinKey: "boardId"
		}
	}
};

var DAO = require('daoism/dao').DAO;
var CommentDAO  = exports.CommentDAO = function(orm){
	orm = orm || CommentsORM;
	DAO.call(this, orm, 'Comment DAO');
};
CommentDAO.prototype = Object.create(DAO.prototype);
CommentDAO.prototype.constructor = CommentDAO;

/*CommentDAO.prototype.list = function(settings) {
	var limit = settings.limit;
	var offset = settings.offset;
	var sort = settings.sort;	
	var order = settings.order;
	var expand = settings.$expand;
	var select = settings.$select;
	var flat = settings.flat;
	
	if(expand || select){
		if(select){
			if(select.constructor !== Array){
				if(select.constructor === String){
					select = String(new java.lang.String(""+select));
					select = select.split(',').map(function(sel){
						if(select.constructor !== String)
							throw Error('Illegal argument: select array components are expected ot be strings but found ' + (typeof sel));
						return sel.trim();
					});
				} else {
					throw Error('Illegal argument: select expected to be string or array of strings but was ' + (typeof select));
				}
			}
		} else {
			select = Object.keys(this.orm.associationSets);
		}        		
	}

	var listArgs = [];
	for(var key in settings){
		if(settings[key] && settings[key].constructor === Array)
			listArgs.push(' ' + key + settings[key]);
		else
			listArgs.push(' ' + key + '[' + settings[key] + ']');
	}
	
	this.$log.info('Listing '+this.orm.dbName+' entities with list operators:' + listArgs.join(','));

	var sql = "SELECT";
    if (limit !== undefined && offset !== undefined) {
        sql += " " + this.datasource.getPaging().genTopAndStart(limit, offset);
    }
    sql += " * FROM "+this.orm.dbName+" LEFT JOIN USR_USER AS u ON "+this.orm.getProperty('user').dbName+" = u.USRU_UNAME ";
    
    //add where clause for any relations 
    var self = this;
    var keyDefinitions = this.orm.associationKeys().filter(function(joinKey){
    	for(var settingName in settings){
    		if(settingName === joinKey)
    			return joinKey;
    	}
    	return;
    }).filter(function(keyDef){
    	return keyDef!==undefined;
    }).map(function(key){
    	var matchedDefinition = self.orm.properties.filter(function(property){
    		return key === property.name;
    	});
    	return matchedDefinition?matchedDefinition[0]:undefined;
    }).filter(function(keyDef){
    	return keyDef!==undefined;
    });
    if(keyDefinitions.length>0){
    	sql += ' WHERE';
	    for(var i=0; i<keyDefinitions; i++){
        	var def = keyDefinitions[i];
        	sql += ' ' + def.dbName + '=?, ';
        }
    	sql = sql.substring(0, sql.length-2);	
    }
    
    sql+= " ORDER BY ";
    if(!flat){
    	sql += this.orm.getProperty('replyToCommentId').dbName+" DESC, ";
    }
    
    sql += this.orm.getProperty('publishTime').dbName; //default ordering
    if (sort !== null && sort !== undefined && sort !== 'publishTime') {
    	if(sort.cosntructor !== Array){
    		sort = [sort];
    	}
    	for(var idx in sort)
        	sql += ","+sort[idx];
    }
    if (sort !== undefined && order !== undefined) {
        sql += " " + order;
    }
    if (limit !== undefined && offset !== undefined) {
        sql += " " + this.datasource.getPaging().genLimitAndOffset(limit, offset);
    }

    var connection = this.datasource.getConnection();
    try {
        settings.select = select;
		this.$log.info('Prepare statement: ' + sql);
        var statement = connection.prepareStatement(sql);
	
		//Bind statement parameters if any
        for(var i=0; i<keyDefinitions.length; i++){
        	var val = settings[keyDefinitions[i].name];
        	this.$log.info('Binding to parameter[' + (i+1) + ']:' + val);
        	statement['set'+keyDefinitions[i].type]((i+1), val);
        }
		
		var entities = [];
        var resultSet = statement.executeQuery();        
        while (resultSet.next()) {
        	var entity = this.createEntity(resultSet, select);
	        entities.push(entity);
			this.notify('afterFound', entity);
        	if(expand && this.orm.associationSets){
				for(var idx in Object.keys(this.orm.associationSets)){
					var associationName = Object.keys(this.orm.associationSets)[idx];
					if(expand.indexOf(associationName)>-1){
						entity[associationName] = this.expand([associationName], entity);
					}
				}
        	}
        }

        //TODO: move this piece in an event callback and delete this whole method. and make recursive function
		if(!flat){
			var idPropertyName = this.orm.getPrimaryKey().name;
			entities = entities.map(function(_it){
				if(!_it.replyToCommentId){
					if(!_it.replies)
						_it.replies = [];
					for(var i in entities){
						var entity = entities[i];
						if(_it[idPropertyName] === entity.replyToCommentId){
							_it.replies.push(entity);
						}
					}
				}
				return _it;
			}).filter(function(property){
				return property.replyToCommentId===undefined || property.replyToCommentId===0;//?
			});
		}
        
        this.$log.info('' + entities.length +' '+this.orm.dbName+' entities found');
        
        return entities;
    } finally {
        connection.close();
    }
};*/

/*CommentDAO.prototype.findComments = function(boardId, expanded) {	

	this.$log.info('Finding '+this.orm.dbName+' entities with list operators boardId['+boardId+'], expanded['+expanded+']');

    var connection = this.datasource.getConnection();
    try {
        var items = [];
        var sql = "SELECT * FROM "+this.orm.dbName+" LEFT JOIN USR_USER AS u ON "+this.orm.getProperty('user').name+" = u.USRU_UNAME WHERE "+this.orm.getProperty('boardId').name+"=? AND "+this.orm.getProperty('replyTo').name+" IS NULL";
        var statement = connection.prepareStatement(sql);
        statement.setLong(1, boardId);
        
        var resultSet = statement.executeQuery();
		while (resultSet.next()) {
			var item = this.createEntity(resultSet);
            items.push(item);
            if(expanded){
            	item.replies = exports.findReplies(boardId, item.id);
            }
        }
        
        this.$log.info('' + items.length +' '+this.ormdbName+' entities found');
        
        return items;

    } finally {
        connection.close();
    }
};

CommentDAO.prototype.findReplies = function(boardId, commentId) {

	this.$log.info('Finding '+this.orm.dbName+' entities with list operators boardId['+boardId+'], commentId['+commentId+']');

    var connection = this.datasource.getConnection();
    try {
        var items = [];
        var sql = "SELECT * FROM "+this.orm.dbName+" LEFT JOIN USR_USER AS u ON "+this.orm.getProperty('user').name+" = u.USRU_UNAME WHERE "+this.orm.getProperty('boardId').name+"=? AND "+this.orm.getProperty('replyTo').name+"=?";
        var statement = connection.prepareStatement(sql);
        statement.setLong(1, boardId);
        statement.setLong(2, commentId);
        
        var resultSet = statement.executeQuery();
		while (resultSet.next()) {
            items.push(this.createEntity(resultSet));
        }
        
        this.$log.info('' + items.length +' '+this.ormdbName+' entities found');
        
        return items;

    } finally {
        connection.close();
    }
};*/

exports.get = function(){
	var dao = new CommentDAO(CommentsORM);
	return dao;
};

})();
