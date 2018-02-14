/** author: amnn314 */
const request = require('request');
const {URL} = require('url');

// how many attempts to make for each URL (may be passed as a command-line parameter)
const g_attempts_count = process.argv[2] ? process.argv[2] : 10;
// delay between attempts in milliseconds
const g_rest_time = 5000;

const g_data = [
  "https://api.bitfinex.com/v1/pubticker/btcusd",
  "https://api.binance.com/api/v3/ticker/bookTicker?symbol=LTCBTC",
  "https://wex.nz/api/3/info",
  "https://poloniex.com/public?command=returnOrderBook&currencyPair=BTC_NXT&depth=10",
  "https://bittrex.com/api/v1.1/public/getticker?market=BTC-LTC",
  "https://dsx.uk/mapi/ticker/btcusd",
  // you're welcome to add more here if needed
];


function do_request(url, result_cb) {
  request.get({ 'url' : url, 'time' : true},
    function(error, response, body) {
      if (error) {
        console.log('error: ', error);
        return result_cb(true);
      }
      //console.log(response.headers);
      //console.log(response.timings);
      //console.log(response.timingPhases);
      //console.log(body);
      result_cb(null, response.elapsedTime, response.timingPhases.tcp);
  });
}

function do_many_requests(url, count, time_array, tcp_time_array, result_cb, attempts_left) {
  if (attempts_left === undefined)
    attempts_left = count;

  if (attempts_left == 0)
    return result_cb(time_array, tcp_time_array);

  console.log((count - attempts_left + 1) + "/" + count);
  do_request(url, function(e, time, tcp_time) {
    if (e)
      return result_cb(null, null);;
    time_array.push(Math.round(time));
    tcp_time_array.push(Math.round(tcp_time));
    setTimeout(function(){ do_many_requests(url, count, time_array, tcp_time_array, result_cb, attempts_left - 1); }, g_rest_time);
  })
}

function average(items) {
  if (!items || !items.length)
    return 0;
  let total = 0.0;
  for(let i = 0; i < items.length; i++) {
      total += items[i];
  }
  return total / items.length;
}

function str_fill(str, char, len, fill_left) {
  if (str.length >= len)
    return str;
  return (fill_left ? "" : str) + char.repeat(len - str.length) + (fill_left ? str : "");
}

var g_results = [];

g_data.forEach(function(url){
  const u = new URL(url);
  const hostname = u.hostname;

  do_many_requests(url, g_attempts_count, [], [], function(time_array, tcp_time_array) {
    g_results.push({'host' : u.hostname, 'time_array' : time_array, 'tcp_time_array' : tcp_time_array });

    if (g_results.length == g_data.length) {
      g_results.sort(function(l, r){ return (l.host > r.host) ? 1 : (l.host < r.host ? -1 : 0); });
      let max_tcp_time = 0;
      let max_total_time = 0;
      let msg = [];
      for(let i = 0; i < g_results.length; /*nope*/) {
        let r = g_results[i];
        msg.push("***** " + r.host);
        if (r.time_array == null) {
          msg.push("  do data, connection error")
          g_results.splice(i, 1); // remove i
          continue;
        }
        r['tcp_time_average'] = Math.round(average(r.tcp_time_array));
        r['time_average'] = Math.round(average(r.time_array));
        max_tcp_time = Math.max(max_tcp_time, r.tcp_time_average);
        max_total_time = Math.max(max_total_time, r.time_average);
        msg.push("  tcp time, ms:   average: " + r.tcp_time_average + ", raw samples: " + r.tcp_time_array.join(','));
        msg.push("  total time, ms: average: " + r.time_average + ", raw samples: " + r.time_array.join(','));
        ++i;
      }
      console.log(msg.join('\n'));

      console.log("\nBy tcp time, ms (lowest to highest):");
      g_results.sort(function(l, r){ return (l.tcp_time_average > r.tcp_time_average) ? 1 : (l.tcp_time_average < r.tcp_time_average ? -1 : 0); });
      for(let r of g_results) {
        console.log(str_fill(r.host, ' ', 20, true) + " : " + str_fill('', '#', r.tcp_time_average / max_tcp_time * 60, true)
         + " " + r.tcp_time_average);
      }

      console.log("\nBy total time, ms (lowest to highest):");
      g_results.sort(function(l, r){ return (l.time_average > r.time_average) ? 1 : (l.time_average < r.time_average ? -1 : 0); });
      for(let r of g_results) {
        console.log(str_fill(r.host, ' ', 20, true) + " : " + str_fill('', '#', r.time_average / max_total_time * 60, true)
         + " " + r.time_average);
      }

    }
  });

});

