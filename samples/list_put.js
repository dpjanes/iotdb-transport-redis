/*
 *  list_put.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-08-12
 */

const transporter = require("../transporter");
const _ = require("iotdb")._;

const testers = require("iotdb-transport").testers;

const transport = require("./make").transport;
setInterval(() => {
    testers.put(transport)
    testers.list(transport);
}, 2000);

testers.list(transport);
