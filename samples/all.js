/*
 *  all.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-09-09
 */

const transporter = require("../transporter");
const _ = require("iotdb")._;

const testers = require("iotdb-transport").testers;

const transport = require("./make").transport;

testers.all(transport);
