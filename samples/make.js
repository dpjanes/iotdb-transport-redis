/*
 *  make.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-08-10
 */

const iotdb = require('iotdb');
const _ = iotdb._;
const connect = require("../connect");

const transporter = require("../transporter");

const redis_client = connect.connect(require("./redis.json"), (error) => {
    if (error) {
        return console.log("#", _.error.message(error));
    }
})

const transport = transporter.make({
    prefix: "r/D2amZKA6/Mq_n9Fte/t",
    verbose: true,
}, redis_client);

exports.transport = transport;

