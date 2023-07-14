const { WebhookClient, EmbedBuilder } = require("discord.js");
const webhookClient = new WebhookClient({
  url: process.env.webhook,
});

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");
const path = require("path");
var bodyParser = require("body-parser");
var jsonParser = bodyParser.json();
app = express();

app.get("/index.js", function (req, res) {
  res.send({
    error: "nope",
  });
});

const PORT = 3000;
const cookieParser = require("cookie-parser");
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.set("views", __dirname);

const cors = require("cors");
app.use(cors());

function makeId(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { resolveSoa } = require("dns");
const uri = process.env.db;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
client.connect();

const http = require("http");
var WebSocketServer = require("ws").Server;
const httpserver = http.Server(app);

var wss = new WebSocketServer({ server: httpserver });
var connections = []
wss.on("connection", function (ws) {
  connections.push({
    socket: ws,
    user: null,
    time: Date.now(),
  })
  var isScatt = false
  ws.send(JSON.stringify({ connected: true }));
  ws.on("message", async function(msg) {
    msg = JSON.parse(msg)
    if (isScatt) {
      connections.filter((el) => el.user === msg.user).forEach(function(el) {
        el.socket.send(JSON.stringify({
          message: msg.content
        }))
      })
    } else {
      var found = connections.find((el) => el.socket === ws)
      if (found.user) {
        if (msg.type === "send") {
          connections.find((el) => el.isScatt === true)?.socket.send(JSON.stringify({
              message: msg.content,
              user: found.user,
              type: "message",
            }))
        }
      } else {
        if (msg.type === "verify" && msg.token) {
          var token = await client.db("verify").collection("tokens").findOne({
            expired: false,
            code: msg.token,
          });
          if (token) {
            found.user = token.user
            connections.find((el) => el.isScatt === true)?.socket.send(JSON.stringify({
              user: token.user,
              type: "join",
            }))
            await client
              .db("verify")
              .collection("tokens")
              .updateOne(
                {
                  expired: false,
                  code: msg.token,
                },
                {
                  $set: {
                    expired: true,
                  },
                },
                {
                  upsert: true,
                }
              );
          }
        }
      }
    }
    if (msg.type === "verifyScatt") {
      if (msg.code && msg.code === process.env.server) {
        isScatt = true
        connections.find((el) => el.socket === ws).isScatt = true
      }
    }
  })
  ws.on("close", function () {
    connections.find((el) => el.isScatt === true)?.socket.send(JSON.stringify({
      user: connections.find((el) => el.socket === ws).user,
      type: "leave",
    }))
    var found = connections.find((el) => el.socket === ws)
    if (found.isScatt) {
      webhookClient.send({
        username: "Important Notification",
        content: `Scatt disconnected from support monitoring system.`,
        avatarURL:
          "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
      });
    }
    found = {}
  });
})

app.get("/connections/", function(req, res) {
  res.send(connections)
})

app.get("/", async function (req, res) {
  res.send("Currently running.");
});

app.get("/latest/", function (req, res) {
  res.send({
    version: "3.0.0-beta",
    beta: 2,
  });
});

app.get("/isbeta/:username/", async function (req, res) {
  var user = await client.db("beta").collection("users").findOne({
    username: req.params.username.toLowerCase(),
  });
  if (user?.beta) {
    res.send({
      beta: true,
    });
  } else {
    res.send({
      beta: false,
    });
  }
});

app.get("/get-token/", async function (req, res) {
  if (
    ObjectId.isValid(req.query.secret) &&
    req.query.server === process.env.server
  ) {
    var token = await client
      .db("beta")
      .collection("tokens")
      .findOne({
        _id: new ObjectId(req.query.secret),
      });
    if (token && !token.grabbed) {
      await client
        .db("beta")
        .collection("tokens")
        .updateOne(
          {
            _id: new ObjectId(req.query.secret),
          },
          {
            $set: {
              grabbed: true,
            },
          },
          {
            upsert: true,
          }
        );
      res.send({
        token: token.token,
        user: token.user
      });
    } else {
      res.send({
        error: "Authentication failed.",
      });
    }
  }
});

app.get("/beta-joined/", async function (req, res) {
  if (req.query.privateCode) {
    fetch(
      `https://auth.itinerary.eu.org/api/auth/verifyToken?privateCode=${req.query.privateCode}`,
      { method: "GET" }
    )
      .then((response) => response.json())
      .then(async function (data) {
        if (
          data.valid === true &&
          data.redirect === "https://data.scratchtools.app/beta-joined/"
        ) {
          var user = await client.db("beta").collection("users").findOne({
            username: data.username.toLowerCase(),
          });
          var secret = makeId(150);
          var token = await client.db("beta").collection("tokens").insertOne({
            user: data.username,
            token: secret,
            time: Date.now(),
            grabbed: false,
          });
          if (!user?.beta) {
            webhookClient.send({
              username: "ScratchTools Webserver Moderation (Web Feedback)",
              content: `🧪 @${data.username} just joined the ScratchTools beta program.`,
              avatarURL:
                "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
            });
          }
          await client
            .db("beta")
            .collection("users")
            .updateOne(
              {
                username: data.username.toLowerCase(),
              },
              {
                $set: {
                  username: data.username.toLowerCase(),
                  beta: true,
                },
              },
              {
                upsert: true,
              }
            );
          res.redirect(
            "https://scratchtools.zip/joined/?code=" + token.insertedId
          );
        } else {
          res.send("Scratch verification failed.");
        }
      });
  } else {
    res.send("Scratch verification failed.");
  }
});

app.post("/create/", jsonParser, async function (req, res) {
  if (req.body.features && typeof req.body.features === "string") {
    const features = await (
      await fetch(
        "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/features/features.json"
      )
    ).json();
    var enabled = [];
    features.forEach(function (el) {
      if (req.body.features.includes(el.file || el.id)) {
        enabled.push(el.file || el.id);
      }
    });
    enabled = enabled.sort();
    var already = await client.db("features").collection("saved").findOne({
      data: enabled,
    });
    if (already) {
      res.send({
        code: already.code,
      });
    } else {
      var code = makeId(50);
      await client.db("features").collection("saved").insertOne({
        code: code,
        data: enabled,
      });
      res.send({
        code: code,
      });
    }
  } else {
    res.send({
      error: "Features not specified.",
    });
  }
});

app.post("/web-feedback/", jsonParser, async function (req, res) {
  if (
    req.body.useragent &&
    typeof req.body.useragent === "string" &&
    req.body.username &&
    typeof req.body.username &&
    req.body.feedback &&
    typeof req.body.feedback
  ) {
    var embed = new EmbedBuilder()
      .setTitle("New Feedback")
      .setDescription("Feedback has been received via the website.")
      .addFields(
        {
          name: "Username",
          value: req.body.username,
          inline: false,
        },
        {
          name: "Feedback",
          value: req.body.feedback,
          inline: false,
        },
        {
          name: "Useragent",
          value: "`" + req.body.useragent + "`",
          inline: false,
        }
      );
    webhookClient.send({
      username: "ScratchTools Webserver Moderation (Web Feedback)",
      avatarURL:
        "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
      embeds: [embed],
    });
    res.send({
      success: true,
    });
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

app.post("/feedback/", jsonParser, async function (req, res) {
  if (
    req.body.useragent &&
    typeof req.body.useragent === "string" &&
    req.body.settings &&
    typeof req.body.settings === "string" &&
    req.body.username &&
    typeof req.body.username &&
    req.body.feedback &&
    typeof req.body.feedback &&
    req.body.version &&
    typeof req.body.version === "string"
  ) {
    var embed = new EmbedBuilder()
      .setTitle("New Feedback")
      .setDescription("Feedback has been received via the extension.")
      .addFields(
        {
          name: "Username",
          value: req.body.username,
          inline: false,
        },
        {
          name: "Feedback",
          value: req.body.feedback,
          inline: false,
        },
        {
          name: "Version",
          value: "`" + req.body.version + "`",
          inline: false,
        },
        {
          name: "Useragent",
          value: "`" + req.body.useragent + "`",
          inline: false,
        },
        {
          name: "Features Enabled Code",
          value: "`" + req.body.settings + "`",
          inline: false,
        }
      );
    webhookClient.send({
      username: "ScratchTools Webserver Moderation",
      avatarURL:
        "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
      embeds: [embed],
    });
    res.send({
      success: true,
    });
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

app.post("/online/", jsonParser, async function (req, res) {
  if (req.body.user && typeof req.body.user === "string") {
    try {
      var userData = await (
        await fetch(
          `https://trampoline.turbowarp.org/api/users/${req.body.user}/`
        )
      ).json();
    } catch (err) {
      var userData = {
        username: req.body.user,
      };
    }
    if (userData?.username) {
      var found = await client.db("isonline").collection("users").findOne({
        username: userData.username,
      });
      if (found) {
        await client
          .db("isonline")
          .collection("users")
          .updateOne(
            {
              username: userData.username,
            },
            {
              $set: {
                lastOnline: Date.now(),
              },
            },
            {
              upsert: true,
            }
          );
      } else {
        await client.db("isonline").collection("users").insertOne({
          username: userData.username,
          lastOnline: Date.now(),
        });
      }
      res.send({
        success: true,
      });
    } else {
      res.send({
        error: "User not found.",
      });
    }
  } else {
    res.send({
      error: "User not given.",
    });
  }
});

app.get("/name/:user/", async function (req, res) {
  var userData = await (
    await fetch(
      `https://trampoline.turbowarp.org/api/users/${req.params.user}/`
    )
  ).json();
  if (userData.username) {
    var found = await client.db("displaynames").collection("users").findOne({
      username: userData.username,
    });
    if (found) {
      res.send({
        username: userData.username,
        displayName: found.displayName || null,
      });
    } else {
      res.send({
        username: userData.username,
        displayName: null,
      });
    }
  } else {
    res.send({
      error: "User not found.",
    });
  }
});

function makeId(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

app.get("/verification/code/", async function (req, res) {
  var privateKey = makeId(150);
  const min = 100000000;
  const max = 999999999;
  var publicKey = Math.floor(Math.random() * (max - min + 1)) + min;
  await client.db("verify").collection("codes").insertOne({
    time: Date.now(),
    secret: privateKey,
    code: publicKey,
    used: false,
  });
  res.send({
    code: publicKey,
    secret: privateKey,
  });
});

app.get("/status/:username/", async function (req, res) {
  try {
    var userData = await (
      await fetch(
        `https://trampoline.turbowarp.org/api/users/${req.params.username}/`
      )
    ).json();
  } catch (err) {
    var userData = {
      username: req.params.username,
    };
  }
  if (userData?.username) {
    var found = await client.db("plus").collection("users").findOne({
      username: userData.username,
    });
    if (found) {
      res.send({
        status: found.status || null,
      });
    } else {
      res.send({
        status: null,
      });
    }
  } else {
    res.send({
      error: "User not found.",
    });
  }
});

const { emojis } = require("./emojis.js");

app.post("/setstatus/", jsonParser, async function (req, res) {
  if (
    req.body.token &&
    typeof req.body.token === "string" &&
    req.body.status &&
    typeof req.body.status === "string"
  ) {
    if (emojis.includes(req.body.status.toString())) {
      var token = await client.db("verify").collection("tokens").findOne({
        expired: false,
        code: req.body.token,
      });
      if (token) {
        await client
          .db("verify")
          .collection("tokens")
          .updateOne(
            {
              expired: false,
              code: req.body.token,
            },
            {
              $set: {
                expired: true,
              },
            },
            {
              upsert: true,
            }
          );
        var found = await client.db("plus").collection("users").findOne({
          username: token.user,
        });
        if (found) {
          await client
            .db("plus")
            .collection("users")
            .updateOne(
              {
                username: token.user,
              },
              {
                $set: {
                  status: req.body.status,
                  lastUpdated: Date.now(),
                },
              },
              {
                upsert: true,
              }
            );
          webhookClient.send({
            content: `**🪪 Emoji status:** @${token.user} just set their emoji status to \`${req.body.status}\`.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
          });
        } else {
          await client.db("plus").collection("users").insertOne({
            username: token.user,
            lastUpdated: Date.now(),
            status: req.body.status,
          });
          webhookClient.send({
            content: `**🪪 Emoji status:** @${token.user} just set their emoji status to \`${req.body.status}\`.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
          });
        }
        res.send({
          success: true,
        });
      } else {
        res.send({
          error: "Not found.",
        });
      }
    } else {
      res.send({
        error: "Only one emoji is allowed.",
      });
    }
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

app.post("/setdisplay/", jsonParser, async function (req, res) {
  if (
    req.body.token &&
    typeof req.body.token === "string" &&
    req.body.name &&
    typeof req.body.name === "string"
  ) {
    var token = await client.db("verify").collection("tokens").findOne({
      expired: false,
      code: req.body.token,
    });
    if (token) {
      await client
        .db("verify")
        .collection("tokens")
        .updateOne(
          {
            expired: false,
            code: req.body.token,
          },
          {
            $set: {
              expired: true,
            },
          },
          {
            upsert: true,
          }
        );
      var found = await client.db("displaynames").collection("users").findOne({
        username: token.user,
      });
      if (found) {
        if (token.user === req.body.name) {
          await client.db("displaynames").collection("users").deleteOne({
            username: token.user,
          });
          webhookClient.send({
            content: `**🪪 Display Name:** @${token.user} just deleted their display name.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
          });
        } else {
          await client
            .db("displaynames")
            .collection("users")
            .updateOne(
              {
                username: token.user,
              },
              {
                $set: {
                  displayName: req.body.name,
                  lastUpdated: Date.now(),
                },
              },
              {
                upsert: true,
              }
            );
          webhookClient.send({
            content: `**🪪 Display Name:** @${
              token.user
            } just set their display name to \`${req.body.name
              .replaceAll("\n", " ")
              .replaceAll("`", "`")}\`.`,
            username: "ScratchTools Webserver Moderation",
            avatarURL:
              "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
          });
        }
      } else if (token.user !== req.body.name) {
        await client.db("displaynames").collection("users").insertOne({
          username: token.user,
          lastUpdated: Date.now(),
          displayName: req.body.name,
        });
        webhookClient.send({
          content: `**🪪 Display Name:** @${
            token.user
          } just set their display name to \`${req.body.name
            .replaceAll("\n", " ")
            .replaceAll("`", "`")}\`.`,
          username: "ScratchTools Webserver Moderation",
          avatarURL:
            "https://raw.githubusercontent.com/STForScratch/ScratchTools/main/extras/icons/beta/beta128.png",
        });
      }
      res.send({
        success: true,
      });
    } else {
      res.send({
        error: "Not found.",
      });
    }
  } else {
    res.send({
      error: "Missing parameters.",
    });
  }
});

app.post("/verify/", jsonParser, async function (req, res) {
  if (req.body.secret && typeof req.body.secret === "string") {
    var found = await client.db("verify").collection("codes").findOne({
      secret: req.body.secret,
    });
    if (found && !found.used) {
      await client
        .db("verify")
        .collection("codes")
        .updateOne(
          {
            secret: req.body.secret,
          },
          {
            $set: {
              used: true,
            },
          },
          {
            upsert: true,
          }
        );
      var data = await (
        await fetch(
          "https://clouddata.scratch.mit.edu/logs?projectid=854593681&limit=10&offset=0"
        )
      ).json();
      var username = null;
      for (var i in data) {
        var log = data[i];
        if (log.verb === "set_var") {
          if (log.name === "☁ verify") {
            if (log.value.toString() === found.code.toString()) {
              username = log.user;
            }
          }
        }
      }
      if (username) {
        var abc = makeId(100);
        await client.db("verify").collection("tokens").insertOne({
          time: Date.now(),
          user: username,
          code: abc,
          expired: false,
        });
        res.send({
          success: true,
          code: abc,
        });
      } else {
        res.send({
          error: "Verification failed.",
        });
      }
    } else {
      res.send({
        error: "Code not found.",
      });
    }
  } else {
    res.send({
      error: "Missing secret.",
    });
  }
});

app.get("/all/online/", async function (req, res) {
  var all = await client
    .db("isonline")
    .collection("users")
    .find({
      lastOnline: { $gt: Date.now() - 300000 },
    })
    .toArray();
  var usernames = [];
  all.forEach(function (user) {
    usernames.push(user.username);
  });
  res.send(usernames);
});

app.get("/isonline/:username/", async function (req, res) {
  try {
    var userData = await (
      await fetch(
        `https://trampoline.turbowarp.org/api/users/${req.params.username}/`
      )
    ).json();
  } catch (err) {
    var userData = {
      username: req.params.username,
    };
  }
  if (userData?.username) {
    var found = await client.db("isonline").collection("users").findOne({
      username: userData.username,
    });
    if (found && found.lastOnline > Date.now() - 300000) {
      res.send({
        online: true,
        scratchtools: true,
      });
    } else {
      res.send({
        online: false,
        scratchtools:
          found !== null && found.lastOnline > Date.now() - 604800000,
      });
    }
  } else {
    res.send({
      error: "User not found.",
    });
  }
});

app.get("/get/:code/", async function (req, res) {
  var code = await client.db("features").collection("saved").findOne({
    code: req.params.code,
  });
  if (code) {
    res.send(code.data);
  } else {
    res.send({
      error: "Data not found.",
    });
  }
});

httpserver.listen(PORT);
