var express = require('express'),
    eejs = require('ep_etherpad-lite/node/eejs'),
    teamManager = require('ep_etherpad-lite/node/db/TeamManager'),
    https = require('https');

// TODO hardcoded for testing, really get from DB via session
var currentUser = 'rhelmer@mozilla.com';

exports.expressCreateServer = function (hook_name, args, cb) {
    console.log('teampad');
    args.app.use(express.bodyParser());

    args.app.post('/teampad/verify', function(req, res) {
        console.log('sign in attempt');
        var body = JSON.stringify({
          assertion: req.param('assertion', null),
          audience: 'http://' + req.headers.host
        });

        var vreq = https.request({
            host: 'persona.org',
            path: '/verify',
            method: 'POST',
            headers: {
               'Content-Length': body.length,
               'Content-Type': 'application/json'
            }
        }, function(vres) {
            var body = '';
            var session_id = req.cookies.express_sid;
            vres.on('data', function(chunk) { body += chunk; });
            vres.on('end', function() {
                try {
                    username = JSON.parse(body).email;
                    // TODO set up session
                    console.log(username + ' logged in');
                } catch(e) {
                    console.log(e);
                }
            });
            res.redirect('/teampad');
        });
        vreq.write(body);
        vreq.end();
    });

    args.app.post('/teampad/creategroup', function(req, res) {
        console.log('create group');

        var teamName = req.param('teamname', null);
        teamManager.createTeam(teamName, ['pad1'], [currentUser], [currentUser],
            function(err, teamID) {
                console.log(teamID + ' created for ' + teamName);
            });
        res.redirect('/teampad');
    });

    args.app.get('/teampad', function(req, res) { 
        var session_id = req.cookies.express_sid;
        var teamsInfo = [];

        // TODO only if user has valid session, pull team info
        // TODO an index for finding teams by author would make this
        //      *way* faster and easier...
        teamManager.listAllTeams(function(err, teams) {
          for (var team in teams.teamIDs) {
              teamID = teams.teamIDs[team];
              teamManager.listInfo(teamID, function(err, info) {
                  if (info.authors) {
                      if (info.authors.indexOf(currentUser) != -1) {
                          teamsInfo.push(info); 
                      }
                  }
              });
          } 
          res.send(eejs.require('ep_etherpad-lite/templates/teampad/index.html',
                                { teamsInfo: teamsInfo,
                                  signedIn: true}));
        });
    });

    args.app.get('/teampad/:teamName', function(req, res) { 
        var teamName = req.path.split('/')[2];
        var teamInfo = [];

        // TODO an index for finding pads/authors by team would make this
        //      *way* faster and easier...
        teamManager.listAllTeams(function(err, teams) {
          for (var team in teams.teamIDs) {
              teamID = teams.teamIDs[team];
              teamManager.listInfo(teamID, function(err, info) {
                  if (info.name) {
                      if (teamName === info.name) {
                          teamInfo = info;
                      }
                  }
              });
          } 

          console.log(teamInfo);
          
          res.send(eejs.require('ep_etherpad-lite/templates/teampad/team.html',
                                {teamInfo: teamInfo,
                                 signedIn: true}));
        });
    });

    args.app.get('/teampad/:teamName/:padName', function(req, res) { 
        var padName = req.path.split('/')[3];

        res.send(eejs.require('ep_etherpad-lite/templates/teampad/pad.html'));
    });
}
