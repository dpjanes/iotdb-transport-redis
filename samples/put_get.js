/*
 *  put_get.js
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
    console.log("-")
    testers.put(transport)
    testers.get(transport);
}, 2000);
