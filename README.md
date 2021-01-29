Welcome to TaintScript!

Here we have a working prototype for TaintScript. It is designed to be an illustrative example rather than a fully robust piece of production software, and as a result it will assume certain features about the input script. For example, the translation script will throw an error if conditional statements do not branch on a binary operator or if the arguments passed into a method are not in a particular format, among other things. There is also some undertainting, as the translation script will not follow into user-defined methods or propagate taint if there are more than two variables to the right of an assignment (so a=b+c works but not a=b+c+d) - there is also overtainting, since the script does not catch edge cases where a=b-b or a=b^b should not propagate taint if b is tainted. However, this is fine, since our project was never about innovating on the taint tracking logic but instead on creating an intuitive and easy-to-use taint tracker. More robust functionality can be implemented in a more complete version of the software later down the line.

With that said, here's how it works:
1. The translate.js script is where the magic happens - it accepts the path to a JavaScript file as input
2. Running translate.js on an input file will print out a modification with taint-tracking version to the terminal

So, the usage can be summarized as follows:
Usage: node translate.js [input_file] > [output_file]

Simple, right? That's the idea

Once you have the new file, replace the old one and run your site on a test server to check if taint is being leaked

We've included a test web application that you can use to see it in action. If you haven't already, you'll probably want to install things like flask/flask_socketio in Python and esprima/escodegen in JavaScript to get it to work. Then, go to the test_server directory and type "flask run" to start up the web server. Visit the page and you should see a form, with the current communication protocol listed in the top left. Clicking submit will alert the server of the request, and you should see three messages listed in the server output:
(1/3) Fetch received
(2/3) XHR received
(3/3) Socket received
So the client sent information to the server over these three communations channels. Now let's apply taint tracking. In our example, we model the form element with id='rec' to be sensitive, and the script.js in the static folder will try to send out that data over various channels. To generate the new file, type "node translate.js test_server/static/script.js" to get the modified taint tracking version. Redirect the output into a file and replace the old script.js with the new taint tracking version. Spawn the web server again and click the submit button on the form, however in the console of the web inspector you should see:
TS ALERT: Object (val6) sent over http: via the Fetch API
TS ALERT: Object (val6) sent over http: via XMLHttpRequest
TS ALERT: Object (val6) sent over http: via WebSockets
And that's all! The new script correctly propagated the taint throughout the program and correctly identified that a tainted variable was sent over an insecure protocol. As stated in the paper, it is now up to the discretion of the developer to decide how to remedy the issue depending on what the intended behavior of the program is.

Questions or comments? Reach out to mshabet@college.harvard.edu