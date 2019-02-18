#!/usr/bin/env node

const exec = require('child_process').exec;
const ora = require('ora');
const meow = require('meow');
const stripAnsi = require('strip-ansi');
const { prompt } = require('enquirer');

const cli = meow(`
		Usage:
			$ teardown surge

			By default teardown will fetch all surge.sh projects.

		Options:
			surge			Get the list of all surge.sh projects to delete.
`,
	{
		flags: {
			surge: {
				type: 'boolean'
			}
		}
	}
);

const input = cli.input.length ? cli.input : 'surge';

const spinner = ora('Getting the list of surge.sh projects, pls wait!').start();

const services = {
	surge: {
		whoami: 'surge whoami',
		list: 'surge list',
		teardown: 'surge teardown'
	}
};

const asyncExec = command =>
	new Promise((resolve, reject) => {
		exec(`${command}`, (err, stdout, stderr) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(stdout);
		});
	});

const isAuthenticated = () => asyncExec(services[input].whoami);

isAuthenticated()
	.then(stdout => {
		const result = stripAnsi(stdout)
			.split('\n')
			.map(s => s.trim())
			.filter(Boolean);

		spinner.stop();

		if (result.length && result[0] === 'Not Authenticated') {
			console.log('\n Make sure you are logged into surge.sh and try again.\n');
			return;
		}
	})
	.catch(err => {
		spinner.stop();
		console.log('\n Error occurred while getting the list of projects.\n', err);
		process.exit();
	});

const getListOfProjects = () => asyncExec(services[input].list);

getListOfProjects()
	.then(async projects => {
		const listOfProjects = stripAnsi(projects)
			.split('\n')
			.map(s => s.trim())
			.filter(Boolean)
			.map(list => list.split(' ')[1]);

		const userResponse = await prompt([
			{
				type: 'select',
				name: 'projects',
				message: 'Select the surge.sh projects to delete (Space to select or Esc to cancel)',
				choices: listOfProjects,
				highlight: true,
				multiple: true
			}
		]);

		spinner.stop();

		spinner.text = `Tearing down the selected projects, pls wait..`;
		spinner.start();

		if (userResponse.projects.length) {
			const done = Promise.all([
				new Promise((resolve, reject) => {
					userResponse.projects.map(project => teardown(project, resolve, reject));
				})
			]);

			done
				.then(() => {
					spinner.stop();
					console.log(`\n ✅ Selected projects deleted successfully! \n`);
				})
				.catch(err => {
					spinner.stop();
					console.log(`\n Error occurred while deleting some of the surge.sh projects! \n`, err);
				});
		} else {
			spinner.stop();
			console.log(`\n Pls select the projects to deleted. \n`);
		}
	})
	.catch(err => {
		spinner.stop();
		if (!err) {
			console.log('\n 🥑 You canceled it.\n', err);
		} else console.log('Error occurred while getting list of surge.sh projects', err);
	});

const teardown = (project, resolve, reject) => {
	exec(`${services[input].teardown} ${String(project)}`, err => {
		if (err) {
			reject(err);
			return;
		}
		resolve(project);
	});
};
