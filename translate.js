// FileName: translate.js
// Author: Matthew Shabet
// Last Modified On: 11 December 2020

var esprima = require('esprima');
var escodegen = require('escodegen');
const fs = require('fs');
var XHRs = new Array();
var sockets = new Array();

// Load in the file
const file = fs.readFileSync(process.argv[2], 'utf8');
// Create the syntax tree of the script
var parsed = esprima.parse(file);
var body = parsed.body;

// Apply taint tracking to each method in the script
for (i = 0; i < body.length; i++) {
	if (body[i].type == 'FunctionDeclaration') {
		modify(body[i].body.body);
	}
}

// This function takes in a method and applies taint tracking to it
function modify(tree) {
	// These structures store which objects and storage elements are tainted
	tree.unshift(esprima.parse('var TSobjects = new Array();'));
	tree.unshift(esprima.parse('var TSlocalStorage = new Array();'));
	tree.unshift(esprima.parse('var TSsessionStorage = new Array();'));

	// Loop through each line in the method
	for (i = 0; i < tree.length; i++) {
		// Check the syntax
		switch(tree[i].type) {
			case 'VariableDeclaration':
				i += taintVariableDeclaration(tree, i);
				break;
			case "IfStatement":
				taintIfStatement(tree[i]);
				break;
			case "ExpressionStatement":
				i += taintExpressionStatement(tree, i);
				break;
			default:
				break;
		}
	}
}

// Add tainting logic relating to variable declaration
function taintVariableDeclaration(tree, i) {
	var decl = tree[i].declarations[0];
	// If prefixed by TSsecure_, then taint
	if (decl.id.name.substring(0,'TSsecure_'.length) == 'TSsecure_') {
		tree.splice(i, 0, esprima.parse('TSobjects.push("' + decl.id.name + '")'));
		return 1;
	}
	// Propagate taint from right to left
	if (decl.init && decl.init.type == 'Identifier') {
		// RHS is an identifier
		var cond1 = 'if (TSobjects.indexOf("' + decl.init.name + '") >= 0)';
		var cond2 = '{TSobjects.push("' + decl.id.name +'");}';
		tree.splice(i, 0, esprima.parse(cond1 + cond2));
		return 1;
	}
	if (decl.init && decl.init.type == 'BinaryExpression') {
		// RHS is a binary expression
		var cond1 = 'if (TSobjects.indexOf("' + decl.init.left.name + '") >= 0 || ';
		var cond2 = 'TSobjects.indexOf("' + decl.init.right.name + '") >= 0)';
		var cond3 = '{TSobjects.push("' + decl.id.name +'");}';
		tree.splice(i, 0, esprima.parse(cond1 + cond2 + cond3));
		return 1;
	}
	if (decl.init && decl.init.type == 'CallExpression') {
		// RHS is a pull from sessionStorage
		if (decl.init.callee.type == 'MemberExpression' && decl.init.callee.object.name == "sessionStorage") {
			var cond1 = 'if (TSsessionStorage.indexOf("' + decl.init.arguments[0].value + '") >= 0)';
			var cond2 = '{TSobjects.push("' + decl.id.name +'");}';
			tree.splice(i, 0, esprima.parse(cond1 + cond2));
			return 1;
		}
		// RHS is a pull from localStorage
		if (decl.init.callee.type == 'MemberExpression' && decl.init.callee.object.name == "localStorage") {
			var cond1 = 'if (TSlocalStorage.indexOf("' + decl.init.arguments[0].value + '") >= 0)';
			var cond2 = '{TSobjects.push("' + decl.id.name +'");}';
			tree.splice(i, 0, esprima.parse(cond1 + cond2));
			return 1;
		}		
	}
	// Keep track of open WebSockets or XMLHttpRequests
	var dec = tree[i].declarations[0]
	if (dec.init && dec.init.type != "MemberExpression") {
		if (dec.init.callee.name == "XMLHttpRequest") {
			XHRs.push(dec.id.name);
		}
		if (dec.init.callee.name == "io") {
			sockets.push(dec.id.name);
		}
	}
	return 0;
}

// Add tainting logic relating to conditionals
function taintIfStatement(block) {
	// "if" logic
	if (block.consequent.type == "BlockStatement") {
		taintConsequent(block.consequent.body, block.test.left, block.test.right);
	} else {
		taintIfStatement(block.consequent);
	}
	// "else if" and "else" logic
	if (block.alternate) {
		if (block.alternate.type == "IfStatement") {
			taintIfStatement(block.alternate);
		}
		else {
			taintConsequent(block.alternate.body, block.test.left, block.test.right);
		}
	}
}
// Helper method for taintIfStatement
function taintConsequent(block, left, right) {
	// Loop through each line of the conditional body
	for (j = 0; j < block.length; j++) {
		// If we are assigning variables, then propagate taint
		if (block[j].expression.type == "AssignmentExpression") {
			if (left.type == "Identifier") {
				var cond1 = 'if (TSobjects.indexOf("' + left.name + '") >= 0)';
				var cond2 = '{TSobjects.push("' + block[j].expression.left.name +'");}';
				block.splice(j, 0, esprima.parse(cond1 + cond2));
				j++;
			}
			else if (right.type == "Identifier") {
				var cond1 = 'if (TSobjects.indexOf("' + right.name + '") >= 0)';
				var cond2 = '{TSobjects.push("' + block[j].expression.left.name +'");}';
				block.splice(j, 0, esprima.parse(cond1 + cond2));
				j++;
			}
		}
	}
}

// Add tainting logic relating to function calls
// Also check if sensitive data is being sent out
function taintExpressionStatement(tree, i) {
	// Propagate taint through Web Storage queries
	if (tree[i].expression.type == 'CallExpression' && tree[i].expression.callee.type == "MemberExpression") {
		// If updating sessionStorage
		if (tree[i].expression.callee.object.name == 'sessionStorage') {
			var cond1 = 'if (TSobjects.indexOf("' + tree[i].expression.arguments[1].name + '") >= 0)';
			var cond2 = '{TSsessionStorage.push("' + tree[i].expression.arguments[0].value +'");}';
			tree.splice(i, 0, esprima.parse(cond1 + cond2));
			return 1;
		}
		// If updating localStorage
		if (tree[i].expression.callee.object.name == 'localStorage') {
			var cond1 = 'if (TSobjects.indexOf("' + tree[i].expression.arguments[1].name + '") >= 0)';
			var cond2 = '{TSlocalStorage.push("' + tree[i].expression.arguments[0].value +'");}';
			tree.splice(i, 0, esprima.parse(cond1 + cond2));
			return 1;
		}
	}

	// Check if sensitive data is leaked
	if (tree[i].expression.type == 'CallExpression') {
		var callee = tree[i].expression.callee;
		// Fetch API
		if (callee.type == 'Identifier' && callee.name == 'fetch') {
			var param = tree[i].expression.arguments[1].properties[1].value.right.name;
			var cond1 = 'if (TSobjects.indexOf("' + param + '") >= 0 && ';
			var cond2 = '(location.protocol == "http:" || location.protocol == "ftp:"))';
			var str = 'TS ALERT: Object (' + param + ') sent over " + location.protocol + " via the Fetch API';
			var cond3 = '{console.log("' + str + '");}';
			tree.splice(i, 0, esprima.parse(cond1 + cond2 + cond3));
			return 1;
		}
		// XMLHttpRequest
		if (callee.property.name == 'send' && XHRs.indexOf(callee.object.name) >= 0) {
			var param = tree[i].expression.arguments[0].right.name;
			var cond1 = 'if (TSobjects.indexOf("' + param + '") >= 0 && ';
			var cond2 = '(location.protocol == "http:" || location.protocol == "ftp:"))';
			var str = 'TS ALERT: Object (' + param + ') sent over " + location.protocol + " via XMLHttpRequest';
			var cond3 = '{console.log("' + str + '");}';
			tree.splice(i, 0, esprima.parse(cond1 + cond2 + cond3));
			return 1;
		}
		// WebSocket
		if (callee.property.name == 'send' && sockets.indexOf(callee.object.name) >= 0) {
			var param = tree[i].expression.arguments[0].name;
			var cond1 = 'if (TSobjects.indexOf("' + param + '") >= 0 && ';
			var cond2 = '(location.protocol == "http:" || location.protocol == "ftp:"))';
			var str = 'TS ALERT: Object (' + param + ') sent over " + location.protocol + " via WebSockets';
			var cond3 = '{console.log("' + str + '");}';
			tree.splice(i, 0, esprima.parse(cond1 + cond2 + cond3));
			return 1;
		}
	}
	return 0;
}

// Generate the new .js file
var newCode = escodegen.generate(parsed);
console.log(newCode);