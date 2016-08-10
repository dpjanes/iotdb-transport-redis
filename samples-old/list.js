/*
 *  list.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-05
 *
 *  Demonstrate receiving
 *  Make sure to see README first
 */

var Transport = require('../RedisTransport').RedisTransport;

var transport = new Transport({
});
transport.list({}, function(error, ld) {
    if (error) {
        console.log("#", "error", error);
        return;
    }
    if (!ld) {
        console.log("+", "<end>");
        return;
    }

    console.log("+", ld.id);
});
