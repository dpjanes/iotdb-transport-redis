/*
 *  list.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-08-12
 */

const transporter = require("../transporter");
const _ = require("iotdb")._;

const testers = require("iotdb-transport").testers;

const transport = require("./make").transport;

testers.list(transport);
