document.getElementById("protocol").innerHTML = ("current protocol: " + location.protocol).slice(0, -1);

function main(){
	// Initialize the sensitive variable with data from the form
	var TSsecure_val0 = document.getElementById('rec').value;

	// Simulate JavaScript activity
	var val1 = TSsecure_val0;
	var val2;
	if (val1 == "yes") {
		val2 = " recommends it";
	} else if (val1 == "no") {
		val2 = " does not recommend it";
	}
	var val3 = document.getElementById('name').value;
	var val4 = val3 + val2;

	sessionStorage.setItem('val4', val4);
	var val5 = sessionStorage.getItem('val4');

	localStorage.setItem('val5', val5);
	var val6 = localStorage.getItem('val5');

    // Now attempt to send the user data to the server
    // 1. Send over the Fetch API
    fetch("http://127.0.0.1:5000/", {method: "POST", body: "Fetch API: " + val6});

    // 2. Send over using an XMLHttpRequest
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "http://127.0.0.1:5000/", true);
    xhr.send("XMLHttpRequest: " + val6);

    // 3. Send over WebSocket
    var socket = io();
    socket.send(val6);
}