from flask import Flask, render_template, request
from flask_socketio import SocketIO, send, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

@socketio.on('message')
def handle_message(message):
    print('(3/3) Socket received')

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'GET':
        return render_template('home.html')
    if request.method == 'POST':
        if (request.data[:9] == b'Fetch API'):
            print("(1/3) Fetch received")
        if (request.data[:14] == b'XMLHttpRequest'):
            print("(2/3) XHR received")
        return "Form received"
   
if __name__ == '__main__':
    socketio.run(app)