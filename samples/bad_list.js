/*
 *  bad_list.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-05
 *
 *  Deal with data that does not exist
 *  Expect to see just 'null'
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
