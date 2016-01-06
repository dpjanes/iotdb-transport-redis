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
transport.list(function(ld) {
    if (ld.end) {
        console.log("+", "end");
        return;
    }

    console.log("+", ld.id);
});
