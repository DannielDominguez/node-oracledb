/* Copyright (c) 2017, Oracle and/or its affiliates. All rights reserved. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * The node-oracledb test suite uses 'mocha', 'should' and 'async'.
 * See LICENSE.md for relevant licenses.
 *
 * NAME
 *   93. binding_procedureBindIn.js
 *
 * DESCRIPTION
 *   This suite tests the data binding, including:
 *     Test cases bind in oracledb type STRING/BUFFER to all db column types using plsql procedure
 *     The cases take small/null bind values.
 *
 * NUMBERING RULE
 *   Test numbers follow this numbering rule:
 *     1  - 20  are reserved for basic functional tests
 *     21 - 50  are reserved for data type supporting tests
 *     51 onwards are for other tests
 *
 *****************************************************************************/
'use strict';

var oracledb = require('oracledb');
var should   = require('should');
var async    = require('async');
var sql      = require('./sql.js');
var dbConfig = require('./dbconfig.js');
var assist   = require('./dataTypeAssist.js');

describe('93.binding_procedureBindIn.js', function() {
  this.timeout(5000);
  var connection = null;
  var executeSql = function(sql, callback) {
    connection.execute(
      sql,
      function(err) {
        should.not.exist(err);
        return callback();
      }
    );
  };

  before(function(done) {
    oracledb.getConnection(dbConfig, function(err, conn) {
      should.not.exist(err);
      connection = conn;
      done();
    });
  });

  after(function(done) {
    connection.release( function(err) {
      should.not.exist(err);
      done();
    });
  });

  var doTest = function(table_name, proc_name, dbColType, content, bindType, nullBind, callback) {
    async.series([
      function(cb) {
        var bindVar = { c: { val: content, type: bindType, dir: oracledb.BIND_IN } };
        inBind(table_name, proc_name, dbColType, bindVar, bindType, nullBind, cb);
      },
      function(cb) {
        var bindVar =[ { val: content, type: bindType, dir: oracledb.BIND_IN } ];
        inBind(table_name, proc_name, dbColType, bindVar, bindType, nullBind, cb);
      }
    ], callback);
  };

  var inBind = function(table_name, proc_name, dbColType, bindVar, bindType, nullBind, callback) {
    var createTable = sql.createTable(table_name, dbColType);
    var drop_table = "DROP TABLE " + table_name + " PURGE";
    var proc = "CREATE OR REPLACE PROCEDURE " + proc_name + " (inValue IN " + dbColType + ")\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into " + table_name + " ( content ) values (inValue); \n" +
               "END " + proc_name + "; ";
    var sqlRun = "BEGIN " + proc_name + " (:c); END;";
    var proc_drop = "DROP PROCEDURE " + proc_name;
    async.series([
      function(cb) {
        executeSql(createTable, cb);
      },
      function(cb) {
        executeSql(proc, cb);
      },
      function(cb) {
        connection.execute(
          sqlRun,
          bindVar,
          function(err) {
            if(bindType === oracledb.STRING) {
              compareErrMsgForString(nullBind, dbColType, err);
            } else {
              compareErrMsgForRAW(dbColType, err);
            }
            cb();
          }
        );
      },
      function(cb) {
        executeSql(proc_drop, cb);
      },
      function(cb) {
        executeSql(drop_table, cb);
      }
    ], callback);
  };

  var compareErrMsgForString = function(nullBind, element, err) {
    if(element === "BLOB") {
      // ORA-06550: line 1, column 7:
      // PLS-00306: wrong number or types of arguments in call to 'NODB_INBIND_XX'
      // ORA-06550: line 1, column 7:
      // PL/SQL: Statement ignored
      (err.message).should.startWith('ORA-06550:');
    } else {
      if(nullBind === true) {
        should.not.exist(err);
      } else {
        if(element.indexOf("CHAR") > -1 || element === "CLOB") {
          should.not.exist(err);
        }
        if(element.indexOf("FLOAT") > -1 || element === "NUMBER" || element.indexOf("RAW") > -1) {
          // FLOAT ORA-06502: PL/SQL: numeric or value error: character to number conversion error
          // BINARY_FLOAT ORA-06502: PL/SQL: numeric or value error
          // NUMBER: ORA-06502: PL/SQL: numeric or value error: character to number conversion error
          // RAW: ORA-06502: PL/SQL: numeric or value error: hex to raw conversion error
          (err.message).should.startWith('ORA-06502:');
        }
        if(element === "BINARY_DOUBLE") {
          // ORA-01847: ORA-06502: PL/SQL: numeric or value error
          (err.message).should.startWith('ORA-06502:');
        }
        if(element === "DATE" || element === "TIMESTAMP") {
          // ORA-01858: a non-numeric character was found where a numeric was expected
          (err.message).should.startWith('ORA-01858:');
        }
      }
    }
  };

  var compareErrMsgForRAW = function(element, err) {
    if(element === "NUMBER" || element.indexOf("FLOAT") > -1 || element === "BINARY_DOUBLE" || element === "DATE" || element === "TIMESTAMP" || element === "CLOB") {
      // ORA-06550: line 1, column 7:
      // PLS-00306: wrong number or types of arguments in call to 'NODB_INBIND_XX'
      // ORA-06550: line 1, column 7:
      // PL/SQL: Statement ignored
      (err.message).should.startWith('ORA-06550:');
    }
    if(element.indexOf("CHAR") > -1 || element.indexOf("RAW") > -1 || element === "BLOB") {
      should.not.exist(err);
    }
  };

  var tableNamePre = "table_93";
  var procPre = "proc_93";
  var index = 0;

  describe('93.1 PLSQL procedure: bind in small value of oracledb.STRING/BUFFER', function() {

    it('93.1.1 oracledb.STRING <--> DB: NUMBER', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "NUMBER";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.2 oracledb.STRING <--> DB: CHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "CHAR";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.3 oracledb.STRING <--> DB: NCHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "NCHAR";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.4 oracledb.STRING <--> DB: VARCHAR2', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "VARCHAR2";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.5 oracledb.STRING <--> DB: FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "FLOAT";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.6 oracledb.STRING <--> DB: BINARY_FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "BINARY_FLOAT";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.7 oracledb.STRING <--> DB: BINARY_DOUBLE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "BINARY_DOUBLE";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.8 oracledb.STRING <--> DB: DATE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "DATE";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.9 oracledb.STRING <--> DB: TIMESTAMP', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "TIMESTAMP";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.10 oracledb.STRING <--> DB: RAW', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "RAW";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.11 oracledb.STRING <--> DB: CLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "CLOB";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.12 oracledb.STRING <--> DB: BLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = "small string";
      var bindType = oracledb.STRING;
      var dbColType = "BLOB";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.13 oracledb.BUFFER <--> DB: NUMBER', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "NUMBER";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.14 oracledb.BUFFER <--> DB: CHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "CHAR";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.15 oracledb.BUFFER <--> DB: NCHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "NCHAR";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.16 oracledb.BUFFER <--> DB: VARCHAR2', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "VARCHAR2";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.17 oracledb.BUFFER <--> DB: FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "FLOAT";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.18 oracledb.BUFFER <--> DB: BINARY_FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "BINARY_FLOAT";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.19 oracledb.BUFFER <--> DB: BINARY_DOUBLE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "BINARY_DOUBLE";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.20 oracledb.BUFFER <--> DB: DATE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "DATE";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.21 oracledb.BUFFER <--> DB: TIMESTAMP', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "TIMESTAMP";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.22 oracledb.BUFFER <--> DB: RAW', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "RAW";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.23 oracledb.BUFFER <--> DB: CLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "CLOB";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.1.24 oracledb.BUFFER <--> DB: BLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = assist.createBuffer(100);
      var bindType = oracledb.BUFFER;
      var dbColType = "BLOB";
      var nullBind = false;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });
  });

  describe('93.2 PLSQL procedure: bind in null value of oracledb.STRING/BUFFER', function() {

    it('93.2.1 oracledb.STRING <--> DB: NUMBER', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "NUMBER";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.2 oracledb.STRING <--> DB: CHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "CHAR";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.3 oracledb.STRING <--> DB: NCHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "NCHAR";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.4 oracledb.STRING <--> DB: VARCHAR2', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "VARCHAR2";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.5 oracledb.STRING <--> DB: FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "FLOAT";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.6 oracledb.STRING <--> DB: BINARY_FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BINARY_FLOAT";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.7 oracledb.STRING <--> DB: BINARY_DOUBLE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BINARY_DOUBLE";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.8 oracledb.STRING <--> DB: DATE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "DATE";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.9 oracledb.STRING <--> DB: TIMESTAMP', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "TIMESTAMP";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.10 oracledb.STRING <--> DB: RAW', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "RAW";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.11 oracledb.STRING <--> DB: CLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "CLOB";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.12 oracledb.STRING <--> DB: BLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.STRING;
      var dbColType = "BLOB";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.13 oracledb.BUFFER <--> DB: NUMBER', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "NUMBER";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.14 oracledb.BUFFER <--> DB: CHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "CHAR";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.15 oracledb.BUFFER <--> DB: NCHAR', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "NCHAR";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.16 oracledb.BUFFER <--> DB: VARCHAR2', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "VARCHAR2";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.17 oracledb.BUFFER <--> DB: FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "FLOAT";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.18 oracledb.BUFFER <--> DB: BINARY_FLOAT', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BINARY_FLOAT";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.19 oracledb.BUFFER <--> DB: BINARY_DOUBLE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BINARY_DOUBLE";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.20 oracledb.BUFFER <--> DB: DATE', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "DATE";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.21 oracledb.BUFFER <--> DB: TIMESTAMP', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "TIMESTAMP";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.22 oracledb.BUFFER <--> DB: RAW', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "RAW";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.23 oracledb.BUFFER <--> DB: CLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "CLOB";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });

    it('93.2.24 oracledb.BUFFER <--> DB: BLOB', function(done) {
      index++;
      var table_name = tableNamePre + index;
      var proc_name = procPre + index;
      var content = null;
      var bindType = oracledb.BUFFER;
      var dbColType = "BLOB";
      var nullBind = true;
      doTest(table_name, proc_name, dbColType, content, bindType, nullBind, done);
    });
  });

});
