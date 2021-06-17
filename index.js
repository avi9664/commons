const { App } = require("@slack/bolt");
const token = process.env['BOT_TOKEN']
const fetch = require("isomorphic-unfetch")
const ss = process.env['SIGNING_SECRET']
const tk = `Bearer ${process.env['TABLE_KEY']}`
const hn = process.env['HN_TOKEN']
const channel = "C021CQCHP09" //C021CQCHP09 for test, ??? for actual

const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env['TABLE_KEY'] }).base('appjIEGGFtyw8SHu7');

const app = new App({
	token: token,
	signingSecret: ss
});
let fish = 0;
let game = false;
let players = {};
let fishValue = 0.01;
let bonusValue = 0.1
let permitPrice = 1;
let leFishe = ['https://youtu.be/3uQzdlVsLXY', 'https://youtu.be/gLYg1Pe2_K8', 'https://youtu.be/lPGipwoJiOM', 'https://youtu.be/aN4AigQDp8M', 'https://youtu.be/PHAmpGJbiZM', 'https://youtu.be/zwaRWyS_dqU', 'https://youtu.be/Zx5ZRBIPEiw', 'https://youtu.be/zhFNHBDXa38', 'https://youtu.be/TsSW15SFADA', 'https://youtu.be/JBDGbdphHTA', 'https://youtu.be/kVgGR5wOXsU', 'https://youtu.be/qkI_-ep5JhU']

async function speak(text) {
	try {
		const result = await app.client.chat.postMessage({
			channel: channel,
			token: token,
			text: text
		})
	} catch (e) {
		console.error(e);
	}
}

async function getTxn(id) {
	try {
		const getData = fetch('https://hn.rishi.cx', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'secret': `${hn}`
			},
			body: JSON.stringify({
				query: `
				query GetTransaction($id: String!) {
					transaction(id: $id) {
						balance
						validated
						from {
							id
						}
					}
				}
			`,
				variables: {
					"id": id.toString(),
				},
			}),
		}).then((res) => res.json())
			.then((result) => { return result.data.transaction.validated });
		let paid = await getData;
		return paid;
	} catch (e) {
		console.error(e)
	}
}

async function invoice(user, id) {
	try {
		const createTxn = fetch('https://hn.rishi.cx', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'secret': `${hn}`
			},
			body: JSON.stringify({
				query: `
				mutation AskForMonee($balance: Float!, $from: String!, $bot: String!){
					transact(data: {
						balance: $balance,
						to: $bot,
						from: $from
					}) {
					id
					validated
					balance
				}
			}
			`,
				variables: {
					"balance": permitPrice,
					"bot": "U021CPNLX9P",
					"from": user
				},
			}),
		})
			.then((res) => res.json())
			.then((result) => { return result });
		let result = await createTxn;
		let txn = result.data.transact;
		console.log(result);
		let update = [{
			"id": id,
			fields: {
				last_txn: parseInt(txn.id),
				valid_permit: false,
			}
		}]
		updateBase('users', update)
		return txn;
	} catch (e) {
		console.error(e)
	}
}


async function transact(user, money) {
	fetch('https://hn.rishi.cx', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'secret': `${hn}`
		},
		body: JSON.stringify({
			query: `
				mutation SendMonee($balance: Float!, $to: String!, $bot: String!){
					send(data: {
						balance: $balance,
						to: $to,
						from: $bot
					}) {
					id
					validated
					balance
				}
			}
			`,
			variables: {
				balance: money,
				to: user,
				bot: 'U021CPNLX9P'
			},
		}),
	})
		.then((res) => res.json())
		.then((result) => console.log(result));
}

async function eph(text, user) {
	try {
		const result = await app.client.chat.postEphemeral({
			channel: channel,
			user: user,
			token: token,
			text: text
		})
	} catch (e) {
		console.error(e);
	}
}

async function sendResult(query, add) {
	try {
		if (Object.keys(players).length <= 1) {
			fetch("https://api.airtable.com/v0/appjIEGGFtyw8SHu7/overall/recMMWaz2XxBDz5AS", {
				headers: {
					Authorization: tk
				}
			}).then((res) => res.json())
				.then(async (result) => {
					copy = JSON.parse(JSON.stringify(result));
					copy.fields[query] += add;
					let update = [
						{
							'id': copy.id,
							'fields': copy.fields,
						}
					]
					updateBase('overall', update);
				}).catch((e) => console.error(e))
		}
	} catch (e) {
		console.error(e)
	}
}

async function updateBase(baseName, update) {
	try {
		base(baseName).update(update, function(err, records) {
			if (err) {
				console.error(err);
				return;
			}
		});
	} catch (e) {
		console.error(e)
	}
}

async function createEntry(baseName, entry) {
	try {
		const create = fetch(`https://api.airtable.com/v0/appjIEGGFtyw8SHu7/${baseName}`, {
			body: JSON.stringify(entry),
			method: 'POST',
			headers: {
				Authorization: tk,
				"Content-type": "application/json"
			}
		}).then((res) => res.json())
			.then((result) => { return result; });
		result = await create;
		return result;
	} catch (e) {
		console.error(e)
	}
}

async function checkTransaction(user) {
	try {
		const doCheck = fetch(`https://api.airtable.com/v0/appjIEGGFtyw8SHu7/users?maxRecords=3&view=Grid%20view&filterByFormula=user%3D%22${user}%22`, {
			headers: {
				Authorization: tk
			}
		})
			.then((res) => res.json())
			.then(async (result) => {
				let exists = result.records.length == 0 ? false : true;
				if (exists) {
					let records = result.records[0].fields;
					if (!records.valid_permit) {
						if (records.last_txn == 0) {
							let txn = await invoice(user, result.records[0].id);
							eph(`Hey <@${user}>, before you can fish, you need to get a permit first! I've sent you an invoice for ${permitPrice}HN to help you get started! Just run \`/pay ${txn.id}\` to get your permit and then run /fish again to get started!`, user)
							return false;
						} else {
							let paid = await getTxn(records.last_txn);
							console.log(paid);
							if (paid == true) {
								let now = new Date();
								let update = [{
									id: result.records[0].id,
									fields: {
										valid_permit: true,
										exp_date: now.setDate(now.getDate() + 7),
									}
								}]
								updateBase('users', update)
								eph(`Hey <@${user}>, thanks for paying for the fishing permit! Enjoy your :fish: :sparkling_heart:`, user)
								return true;
							} else if (paid == false) {
								eph(`Hey <@${user}>, if you can afford the permit, please send \`/pay ${records.last_txn}\` to pay for the invoice I've sent you. After you do that, you can type \`/fish\` again. Thanks!`, user)
								return false;
							}
						}
					} else if (records.valid_permit) {
						now = new Date();
						if (new Date(records.exp_date) < now) {
							console.log(records.exp_date, now);
							let txn = await invoice(user, result.records[0].id);
							console.log(txn);
							eph(`Hey <@${user}>, your fishing permit has expired, so you need to get a new permit first! I've sent you another invoice for ${permitPrice}HN to help you get started! Just run \`/pay ${txn.id}\` to get your permit and then run /fish again to get started!`, user)
							return false;
						} else {
							return true;
						}
					}
				} else {
					let entry = {
						records: [{
							fields: {
								user: user,
								wins: 0,
								fish: 0,
								last_txn: 0,
							}
						}]
					};
					let newEntry = await createEntry('users', entry)
					console.log(newEntry.records[0].id);
					let txn = await invoice(user, newEntry.records[0].id);
					eph(`Hey <@${user}>, before you can fish, you need to get a permit first! I've sent you an invoice for ${permitPrice}HN to help you get started! Just run \`/pay ${txn.id}\` to get your permit and then run /fish again to get started!`, user)
					return false;
				}
			})
		let boughtPermit = await doCheck;
		return doCheck;
	} catch (e) {
		console.error(e)
	}
}

async function sendScores() {
	try {
		fetch("https://api.airtable.com/v0/appjIEGGFtyw8SHu7/users?maxRecords=1000&view=Grid%20view", {
			headers: {
				Authorization: tk
			}
		}).then((res) => res.json())
			.then(async (result) => {
				copy = JSON.parse(JSON.stringify(result));
				console.log(copy)

				for (let [key, value] of Object.entries(players)) {
					let index = result.records.findIndex((entry, index) => {
						if (entry.fields.user == key) {
							return true;
						}
					});

					if (index == -1) {
						let update = {
							records: [
								{
									fields: {
										user: key,
										wins: 1,
										fish: value,
									}
								}
							]
						};
						createEntry('users', update)
					} else {
						let update = [{
							id: copy.records[index].id,
							fields: {
								user: key,
								wins: copy.records[index].fields.wins += 1,
								fish: copy.records[index].fields.fish += value,
							}
						}]
						console.log(update)
						updateBase('users', update)
					}
				}
			})
	} catch (e) {
		console.error(e)
	}
}

async function endGame() {
	game = false;
	score = "";
	bonus = 0;
	if (fish >= 20) {
		score = "A"
		await sendResult('As', 1, false)
		bonus = 2 * bonusValue
	} else if (fish >= 10) {
		score = "B"
		await sendResult('Bs', 1, false)
		bonus = 1 * bonusValue
	} else if (fish >= 5) {
		score = "C"
		await sendResult('Cs', 1, false)
	} else {
		score = "D"
		await sendResult('Ds', 1, false)
	}
	await speak(`:hourglass:TIME'S UP!:hourglass:\nThe remaining :fish: population is *${fish}*. Based on your fishing responsibility, you get a rating of *${score}*.`)
	await speak(Object.keys(players).length <= 1 ? "Let me take all that fish-- Wow, that's a _lot_ you've got there! There's only one player, so I won't give you any HN to be fair to others, but I'll still add your fish to the leaderboard!" : `Let me take all that fish-- Wow, that's a _lot_ you've got there! I'll give you ${fishValue}HN per fish for all your hard work!`)
	let list = "";
	for (let [key, value] of Object.entries(players)) {
		list += `<@${key}> - ${value} :fish:\n`
	}
	sendScores();
	await speak(`Here's how many fish each of y'all got: \n${list}`)
	if (bonus > 0 && Object.keys(players).length > 1) {
		await speak(`This game, you've also done well with fishing responsibly! I'll give each of you ${bonus}HN as a bonus!`)
	}
	for (let [key, value] of Object.entries(players)) {
		if (Object.keys(players).length > 1) {
			let money = value * fishValue + bonus
			money = +money.toFixed(2);
			await eph(`:moneybag:Keep your eyes out for a transaction of ${money}HN into your account!`, key)
			transact(key, money)
		}
	}
	fish = 0;
	players = {};
}

async function runGame() {
	let start = new Date().getTime(),
		time = 0;
	async function instance() {
		time += 100;
		if (time % 30000 == 0 && time % 120000 != 0) {
			fish *= 2;
			await speak(`:two:The fish population has doubled! Now there are *${fish}* :fish: in the lake!`)
		}
		if (time % 120000 == 0 && fish > 0) {
			endGame();
		}
		var diff = (new Date().getTime() - start) - time;
		if (game) {
			setTimeout(instance, (100 - diff));
		}
	}
	setTimeout(instance, 100);
}

app.event('app_mention', async (body) => {
	try {
		let e = body.event;
		let c = e.channel;
		let thing = leFishe[Math.floor(Math.random(0, 1) * leFishe.length)]
		speak(thing)
	} catch (e) {
		console.error(e)
	}
})

app.command('/t', async ({ command, ack, say }) => {
	try {
		await ack();
		if (command.user_id == 'UCPRVD7AQ') {
			speak(command.text);
		}
	} catch (e) {
		console.error(e)
	}
})

app.command('/fish-board', async ({ command, ack, say }) => {
	try {
		await ack();
		const board = await fetch("https://api.airtable.com/v0/appjIEGGFtyw8SHu7/users?maxRecords=10&view=Grid%20view", {
			headers: {
				Authorization: tk
			}
		}).then((res) => res.json())
			.then(async (result) => {

				let list = ":trophy:Here's the top 10 fishers so far:\n";
				for (let user of result.records) {
					let stats = user.fields;
					list += `- <@${stats.user}> has ${stats.wins} wins and collected a total of ${stats.fish} :fish:\n`
				}
				await eph(list, command.user_id);
			});
	} catch (e) {
		console.error(e)
	}
});

app.command('/fish', async ({ command, ack, say }) => {
	try {
		await ack();
		let user = command.user_id;
		let boughtPermit = await checkTransaction(user);
		console.log(boughtPermit);
		if (boughtPermit == true) {
			if (!game) {
				fish = 20;
				game = true;
				players = {}
				await say(`Howdy, y'all! Let's go fishing! :fishing_pole_and_fish: Right now, there are *${fish}* :fish: in Hack Lake! Type */fish* to fish`);
				runGame();
			}
			let number = 1;
			if (isNaN(command.text) || command.text <= 0) {
				if (isNaN(command.text) && !/^\s*$/.test(command.text)) {
					await eph(`:warning:Uh oh! You inputted a non-number! I'll change that to 1 fish for now, but next time please input a number between 1 and ${Math.floor(fish / 2)}!`, user)
				} else if (!/^\s*$/.test(command.text) && !isNaN(command.text) && (command.text <= 0 || !isFinite(command.text))) {
					console.log(isNaN(command.text))
					await eph(`:warning:Uh oh! You inputted an invalid number! I'll change that to 1 fish for now, but next time please input a number between 1 and ${Math.floor(fish / 2)}`, user)
				}
				number = 1
			} else {
				number = parseInt(command.text);
				number = fish < number ? fish : number;
				if (fish < number && fish <= 5) {
					await eph(`:warning:Woah! You're hauling way more than the number of fish in the commons! Let's just haul the remaining fish.`, user)
				}
			}
			if (number > fish / 2 && number > 5) {
				await eph(`:warning:Woah! You're hauling over half of the fish in the lake! For the sake of being fair to the others, let's keep that at fifty percent.`, user)
				number = Math.floor(fish / 2);
			}
			if (!players[user]) {
				players[user] = 0;
			}
			players[user] += number;
			fish -= number;
			await say(`:fishing_pole_and_fish: <@${user}> just fished! They now have *${players[user]}* fish.\nThere are now *${fish}* fish remaining!`)
			if (fish <= 0) {
				game = false;
				fish = 0;
				players = {};
				await say(`:skull:GAME OVER:skull:\nOh no!! Y'all've ran out of fish! I'm sorry, but you've gained no profits today :cry:\nNevertheless, thanks for playing!`)
				await sendResult('losses', 1, false)
			}
		}
	} catch (e) {
		console.error(e)
	}
});

app.command('/fish-help', async ({ command, ack, say }) => {
	try {
		await ack();
		say(":wave::skin-tone-4:Howdy! Welcome to the Hack Lake, a place run by me, your local fisherman! ~a.k.a. the primordial but retired Aztec god of fishing, Opochtli, but if you ask about that, I will smite you.~\nYour main goals in this game are simple:\n1. Fish. :fishing_pole_and_fish: :tropical_fish:\n2. PROFIT. :money_mouth_face: :hn:\nBut there's a catch-- no, not the I-got-an-Alaskan-crab type of catch-- *Hack Lake can run out of fish!* :chart_with_downwards_trend: And if you overfish, you lose all the possible profit you'd get. If the number of fish in the lake reaches 0, then you lose the game and get no money! :white_frowning_face: You have :two: minutes to fish, and the fish population doubles every :three::zero: seconds. Can you work with others to get the most profit while responsibly maintaining the :fish: population?\nThis is a test of your character, of your greed, of your willingness to cooperate! Are you ready to prove yourself worthy? Type */fish* or */fish [number]* to start a game and make a catch.")
	} catch (e) {
		console.error(e)
	}
});


(async (req, res) => {
	// Start your app
	try {
		await app.start(process.env.PORT || 3000);
		console.log("The Commons is alive! 🌟")
	} catch (error) {
		console.error(error);
	}
})();