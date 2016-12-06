/* globals $ */
/* eslint-env node, dirigible */
(function(){
"use strict";

var database = require("db/database");

var datasource = database.getDatasource();

var persistentProperties = {
	mandatory: ["disc_id", "disc_disb_id"],
	optional: ["text", "user", "publish_date", "reply_to_disc_id"]
};

var $log = require("discussion_boards/lib/logger").logger;
$log.ctx = "Comment DAO";

// Parse JSON entity into SQL and insert in db. Returns the new record id.
exports.insert = function(item) {
	
	$log.info('Inserting DIS_COMMENT entity');
	
	if(item === undefined || item === null){
		throw new Error('Illegal argument: entity is ' + item);
	}
	
	for(var i = 0; i< persistentProperties.mandatory.length; i++){
		var propName = persistentProperties.mandatory[i];
		if(propName==='disc_id')
			continue;//Skip validaiton check for id. It's epxected to be null on insert.
		var propValue = item[propName];
		if(propValue === undefined || propValue === null){
			throw new Error('Illegal ' + propName + ' attribute value: ' + propValue);
		}
	}
	
    var connection = datasource.getConnection();
    try {
        var sql = "INSERT INTO DIS_COMMENT (DISC_ID, DISC_DISB_ID, DISC_REPLY_TO_DISC_ID, DISC_COMMENT_TEXT, DISC_USER, DISC_PUBLISH_DATE)";
        sql += " VALUES (?,?,?,?,?,?)";

        var statement = connection.prepareStatement(sql);
        item = createSQLEntity(item);
        
        item.disc_id = datasource.getSequence('DIS_COMMENT_DISC_ID').next();

        var j = 0;
        statement.setInt(++j, item.disc_id);
        statement.setInt(++j, item.disc_disb_id);
        statement.setInt(++j, item.reply_to_disc_id);
        statement.setString(++j, item.text);
        
        //TODO: move to frontend svc
        var user = require("net/http/user");
        item.user = user.getName();
        
        statement.setString(++j, item.user);
        
        /* TODO: */
        item.publish_date = new Date().toString();
        statement.setString(++j, item.publish_date);

        statement.executeUpdate();
        
        $log.info('DIS_COMMENT entity inserted with disc_id[' + item.disc_id + ']');
        
        return item.disc_id;
        
    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

// Reads a single entity by id, parsed into JSON object 
exports.find = function(id, expanded) {

	$log.info('Finding DIS_COMMENT entity with id[' + id + ']');

    var connection = datasource.getConnection();
    try {
        var item;
        var sql = "SELECT * FROM DIS_COMMENT WHERE " + exports.pkToSQL();
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, id);
        
        var resultSet = statement.executeQuery();
        if (resultSet.next()) {
            item = createEntity(resultSet);
            if(item){
            	$log.info('DIS_COMMENT entity with id[' + id + '] found');
            	if(expanded){
            		item.comments = exports.findComments(item.disc_disb_id, expanded);
            	}            	
        	}
        }
        
        return item;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

exports.findComments = function(boardId, expanded) {

	$log.info('Finding DIS_COMMENT entities in reply to DIS_BOARD entity with id[' + boardId + ']');

    var connection = datasource.getConnection();
    try {
        var items = [];
        var sql = "SELECT * FROM DIS_COMMENT WHERE DISC_DISB_ID=?";
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, boardId);
        
        var resultSet = statement.executeQuery();
		while (resultSet.next()) {
			var item = createEntity(resultSet);
            items.push(item);
            if(expanded){
            	item.replies = exports.findReplies(boardId, item.disc_id);
            }
        }
        
        $log.info('' + items.length +' DIS_COMMENT entities in reply to DIS_BOARD entity with id['+boardId+'] found');
        
        return items;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

exports.findReplies = function(boardId, commentId) {

	$log.info('Finding DIS_COMMENT entities in reply to DIS_COMMENT entity with id[' + commentId + '] for DIS_BOARD entity with id['+boardId+']');

    var connection = datasource.getConnection();
    try {
        var items = [];
        var sql = "SELECT * FROM DIS_COMMENT WHERE DISC_DISB_ID=? AND DISC_REPLY_TO_DISC_ID=?";
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, boardId);
        statement.setInt(2, commentId);
        
        var resultSet = statement.executeQuery();
		while (resultSet.next()) {
            items.push(createEntity(resultSet));
        }
        
        $log.info('' + items.length +'  DIS_COMMENT entities in reply to DIS_COMMENT entity with id[' + commentId + '] for DIS_BOARD entity with id['+boardId+'] found');
        
        return items;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};


// Read all entities, parse and return them as an array of JSON objets
exports.list = function(boardId, limit, offset, sort, order, expanded) {

	$log.info('Listing DIS_COMMENT entity collection for DIS_BOARD id [' + boardId + '] with list operators: limit['+limit+'], offset['+offset+'], sort['+sort+'], order['+order+'], expanded['+expanded+']');

    var connection = datasource.getConnection();
    try {
        var items = [];
        var sql = "SELECT ";
        if ((limit !== null && limit !== undefined) && (offset !== null && offset !== undefined)) {
            sql += " " + datasource.getPaging().genTopAndStart(limit, offset);
        }
        sql += " * FROM DIS_COMMENT";
        if(boardId !== null && boardId !== undefined){
        	sql += " WHERE DISC_DISB_ID=" + boardId;
        }
        if (sort !== null && sort !== undefined) {
            sql += " ORDER BY " + sort;
        }
        if ((sort !== null && sort !== undefined) && (order !== null && order !== undefined)) {
            sql += " " + order;
        }
        if ((limit !== null && limit !== undefined) && (offset !== null && offset !== undefined)) {
            sql += " " + datasource.getPaging().genLimitAndOffset(limit, offset);
        }

        var statement = connection.prepareStatement(sql);
        var resultSet = statement.executeQuery();
        while (resultSet.next()) {
        	var item = createEntity(resultSet);
        	if(item.reply_to_disc_id === undefined){
        		item.replies = exports.findReplies(item.disc_disb_id, item.disc_id);
        		items.push(item);
    		}
        }
        
        $log.info('' + items.length +' DIS_COMMENT entities found');
        
        return items;
        
    }  catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

//create entity as JSON object from ResultSet current Row
function createEntity(resultSet) {
    var entity = {};
	entity.disc_id = resultSet.getInt("DISC_ID");
	entity.text = resultSet.getString("DISC_COMMENT_TEXT");
	entity.disc_disb_id = resultSet.getString("DISC_DISB_ID");
    entity.user = resultSet.getString("DISC_USER");
    entity.reply_to_disc_id = resultSet.getString("DISC_REPLY_TO_DISC_ID");
    if(entity.reply_to_disc_id < 0){
    	entity.reply_to_disc_id = undefined;
    }
    entity.publish_date = resultSet.getString("DISC_PUBLISH_DATE");
    var user = require("net/http/user");
    entity.editable = entity.user === user.getName();    
    $log.info("Transformation from DB JSON object finished");
    return entity;
}

//Prepare a JSON object for insert into DB
function createSQLEntity(item) {
	var persistentItem = {};
	for(var i=0;i<persistentProperties.mandatory.length;i++){
		persistentItem[persistentProperties.mandatory[i]] = item[persistentProperties.mandatory[i]];
	}
	for(var i=0;i<persistentProperties.optional.length;i++){
		if(item[persistentProperties.optional[i]] !== undefined){
			persistentItem[persistentProperties.optional[i]] = item[persistentProperties.optional[i]];
		} else {
			persistentItem[persistentProperties.optional[i]] = null;
		}
	}
	if(persistentItem.reply_to_disc_id === null){
    	persistentItem.reply_to_disc_id = -1;
    }
	$log.info("Transformation to DB JSON object finished");
	return persistentItem;
}

// update entity from a JSON object. Returns the id of the updated entity.
exports.update = function(item) {

	$log.info('Updating DIS_COMMENT entity with id[' + item!==undefined?item.disc_id:item + ']');

	if(item === undefined || item === null){
		throw new Error('Illegal argument: entity is ' + item);
	}
	
	for(var i = 0; i< persistentProperties.mandatory.length; i++){
		var propName = persistentProperties.mandatory[i];
		var propValue = item[propName];
		if(propValue === undefined || propValue === null){
			throw new Error('Illegal value for property ' + propName + '[' + propValue +'] in DIS_COMMENT for update ' + item);
		}
	}

    var connection = datasource.getConnection();
    try {
        var sql = "UPDATE DIS_COMMENT SET DISC_COMMENT_TEXT = ?, DISC_PUBLISH_DATE = ?, DISC_USER = ?";
        sql += " WHERE DISC_ID = ?";
        
        var statement = connection.prepareStatement(sql);
        item = createSQLEntity(item);

        var i = 0;
        statement.setString(++i, item.text);
        statement.setString(++i, item.publish_date);
        statement.setString(++i, item.user);
        var id = item.disc_id;
        statement.setInt(++i, id);
        statement.executeUpdate();
        
        $log.info('DIS_COMMENT entity with id[' + id + '] updated');
        
        return this;

    } catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};

// delete entity by id. Returns the id of the deleted entity.
exports.remove = function(id) {

	$log.info('Deleting DIS_COMMENT entity with id[' + id + ']');
	
	if(id === undefined || id === null){
		throw new Error('Illegal argument: id[' + id + ']');
	}	

    var connection = datasource.getConnection();
    try {
    	var sql = "DELETE FROM DIS_COMMENT WHERE " + exports.pkToSQL();
        var statement = connection.prepareStatement(sql);
        statement.setInt(1, id);
        statement.executeUpdate();
        
        $log.info('DIS_COMMENT entity with id[' + id + '] deleted');        
        
        return this;
        
    }  catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
};


exports.count = function() {

	$log.info('Counting DIS_COMMENT entities');

    var count = 0;
    var connection = datasource.getConnection();
    try {
    	var sql = 'SELECT COUNT(*) FROM DIS_COMMENT';
        var statement = connection.prepareStatement(sql);
        var rs = statement.executeQuery();
        if (rs.next()) {
            count = rs.getInt(1);
        }
    }  catch(e) {
		e.errContext = sql;
		throw e;
    } finally {
        connection.close();
    }
    
    $log.info('' + count + ' DIS_COMMENT entities counted');         
    
    return count;
};

exports.getPrimaryKeys = function() {
    var result = [];
    var i = 0;
    result[i++] = 'DISC_ID';
    if (result === 0) {
        throw new Error("There is no primary key");
    } else if(result.length > 1) {
        throw new Error("More than one Primary Key is not supported.");
    }
    return result;
};

exports.getPrimaryKey = function() {
	return exports.getPrimaryKeys()[0].toLowerCase();
};

exports.pkToSQL = function() {
    var pks = exports.getPrimaryKeys();
    return pks[0] + " = ?";
};

})();
