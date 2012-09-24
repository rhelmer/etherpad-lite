var express = require('express'),
    async = require('async'),
    eejs = require('ep_etherpad-lite/node/eejs'),
    teamManager = require('ep_etherpad-lite/node/db/TeamManager'),
    sessionManager = require('ep_etherpad-lite/node/db/SessionManager'),
    https = require('https');

exports.expressCreateServer = function (hook_name, args, cb) {
  args.app.use(express.bodyParser());

  // TODO use more generic, pluggable auth, hardcoded to persona for now
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
      vres.on('data', function(chunk) { body += chunk; });
      vres.on('end', function() {
        try {
          account = JSON.parse(body).email;
          validUntil = JSON.parse(body).expires;
          console.log(body);
          var sessionID = req.cookies.express_sid;
          sessionManager.createVerifiedSession(
          sessionID, account, validUntil, function(err, result) {
            if (err) {
              console.log(err);
              return;
            }
          });
          console.log(account + ' logged in');
        } catch(e) {
          console.log(e);
        }
      });
      res.redirect('/teampad');
    });
    vreq.write(body);
    vreq.end();
  });

  args.app.post('/teampad/createteam', function(req, res) {
    var sessionID = req.cookies.express_sid;
    var currentUser = null;
    var signedIn = false;

    sessionManager.getSessionInfo(sessionID, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        currentUser = result.account;
        signedIn = true;
      }
    });


    var teamName = req.param('teamname', null);
    teamManager.createTeam(teamName, [], [currentUser], [currentUser],
      function(err, teamID) {
        console.log(teamID + ' created for ' + teamName);
      });
    res.redirect('/teampad');
  });

  args.app.post('/teampad/createpad', function(req, res) {
    var sessionID = req.cookies.express_sid;
    var currentUser = null;
    var signedIn = false;

    sessionManager.getSessionInfo(sessionID, function(err, result) {
      if (err) {
        console.log(err);
        res.redirect('/teampad');
      } else {
        currentUser = result.account;
        signedIn = true;
      }
    });


    var teamName = req.param('teamname', null);
    var teamID = req.param('teamID', null);
    var padName = req.param('padname', null);
    teamManager.createTeamPad(teamName, teamID, padName, 'super sekrit!',
      function(err, teamID) {
        console.log(padName + ' created for ' + teamName);
      });
    res.redirect('/teampad/' + teamName);
  });

  args.app.post('/teampad/addaccount', function(req, res) {
    var sessionID = req.cookies.express_sid;
    var currentUser = null;
    var signedIn = false;

    async.series([
      function(callback) {
        sessionManager.getSessionInfo(sessionID, callback);
      },
      function(result, callback) {
        currentUser = result.account;

        var teamID = req.param('teamID', null);
        var teamName = req.param('teamname', null);
        var account = req.param('accountname', null);
        console.log('teamID: ' + teamID);
        teamManager.addAccountToTeam(teamID, account, function(err, team) {
          console.log(account+ ' added to ' + teamID);
        });
        res.redirect('/teampad/' + teamName);
      },
    ], function(err) {
      console.log(err);
    });
  });

  args.app.get('/teampad', function(req, res) { 
    var sessionID = req.cookies.express_sid;
    var currentUser = null;
    var signedIn = false;

    sessionManager.getSessionInfo(sessionID, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        currentUser = result.account;
        signedIn = true;
      }
    });

    var teamsInfo = [];

    // TODO an index for finding teams by account would make this
    //    *way* faster and easier...
    teamManager.listAllTeams(function(err, teams) {
      for (var team in teams.teamIDs) {
        teamID = teams.teamIDs[team];
        teamManager.listInfo(teamID, function(err, info) {
          if (info.accounts) {
            if (info.accounts.indexOf(currentUser) != -1) {
              teamsInfo.push(info); 
            }
          }
        });
      } 
      res.send(eejs.require('ep_etherpad-lite/templates/teampad/index.html',
                { teamsInfo: teamsInfo,
                  signedIn: signedIn}));
    });
  });

  args.app.get('/teampad/:teamName', function(req, res) { 
    var sessionID = req.cookies.express_sid;
    var currentUser = null;
    var signedIn = false;

    sessionManager.getSessionInfo(sessionID, function(err, result) {
      if (err) {
        console.log(err);
        res.redirect('/teampad');
      } else {
        currentUser = result.account;
        signedIn = true;

        var teamName = req.path.split('/')[2];
        var teamInfo = {
          pads: [],
          accounts: [],
          name: [],
          teamID: []
        };

        // TODO an index for finding pads/accounts by team would make this
        //    *way* faster and easier...
        teamManager.listAllTeams(function(err, teams) {
          for (var team in teams.teamIDs) {
            teamID = teams.teamIDs[team];
            teamManager.listInfo(teamID, function(err, info) {
              if (info.name) {
                if (teamName === info.name) {
                  teamInfo = info;
                  teamInfo.teamID = teamID;
                }
              }
            });
          } 
    
          console.log(teamInfo);
          res.send(eejs.require('ep_etherpad-lite/templates/teampad/team.html',
                    {teamInfo: teamInfo,
                     signedIn: false}));
        });
      }
    });
  });

  // TODO implement, for now we are linking to normal pads via templates
  args.app.get('/teampad/:teamName/:padName', function(req, res) { 
    var sessionID = req.cookies.express_sid;
    var currentUser = null;
    var signedIn = false;

    sessionManager.getSessionInfo(sessionID, function(err, result) {
      if (err) {
        console.log(err);
        res.redirect('/teampad');
      } else {
        currentUser = result.account;
        signedIn = true;
      }
    });

    var padName = req.path.split('/')[3];

    res.send(eejs.require('ep_etherpad-lite/templates/teampad/pad.html'));
  });
}
