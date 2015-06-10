/**
 * Created by thorul on 30/03/2015.
 */

var module = angular.module('mcapp', ['ngCookies']);

// Below is the code to allow cross domain request from web server through angular.js
module.config(['$httpProvider', function($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
}
]);


module.service('mcService', function($http){
    this.getStatus = function(username, password, cronenv, daysago, callback) {

        var jobs = ['John', 'James', 'Jake'];
        console.log("Service launching http request...");
        $http({
            method: "GET",
            url: "http://adl-riskdb2:8000/cgi-bin/cronacle_status.cgi",
            params: {
                cronacle_username: username,
                cronacle_password: password,
                cronacle_env: cronenv,
                days_ago: daysago
            }
        }).success(function(data) {
            console.log("Service received data.");
            callback(data);
        })
            .error(function(data, status, headers, config) {
                console.log("http request failed.");
                console.log("Data: " + data);
                console.log("headers: " + headers);
            });
    }
});

module.service('curveService', function($http){
    this.getCurves = function(username, password, sybenv, callback) {

        console.log("curveService: launching http request...");
        $http({
            method: "GET",
            url: "http://adl-riskdb2:8000/cgi-bin/curve_templates.cgi",
            params: {
                sybase_username: username,
                sybase_password: password,
                sybase_env: sybenv
            }
        }).success(function(data) {
            console.log("curveService received data.");
            callback(data);
        })
            .error(function(data, status, headers, config) {
                console.log("curveService http request failed.");
                console.log("Data: " + data);
                console.log("headers: " + headers);
            });
    }
});

module.service('bstatsService', function($http){
    this.getStats = function(username, password, sybenv, daysAgo, callback) {

        console.log("bstatsService: launching http request...");

        $http({
            method: "GET",
            url: "http://adl-riskdb2:8000/cgi-bin/batch_stats.cgi",
            params: {
                sybase_username: username,
                sybase_password: password,
                sybase_env: sybenv,
                days_ago: daysAgo
            }
        }).success(function(data) {
            console.log("bstatsService received data.");
            callback(data);
        })
            .error(function(data, status, headers, config) {
                console.log("bstatsService http request failed.");
                console.log("Data: " + data);
                console.log("headers: " + headers);
            });
    }
});

