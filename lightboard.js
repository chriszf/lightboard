/* Lightboard, a multimodal presentation tool
 * The general idea is that the browser gives us a drawing canvas that allows
 * us to interact with it in the style of the paper app with a marker, but also
 * to interpret touch events in 'presentation mode', which should hopefully let
 * you move things around and highlight certain parts, inspired by vim. We
 * start in 'command' mode, which lets us move into the other modes by
 * keystroke.
 *
 * 'i' puts us in insert mode, which allows us to draw. Everything drawn in an
 * 'i' session is a single item for the other modes. Insert mode responds only
 * to mouse events so as to encourage the stylus.
 *
 * 's' is 'show' mode, which lets us 'ping' different parts of the image,
 * selecting it, etc, without us interacting. This is done entirely with touch
 * events.
 */
 
var canvas = null;
var ctx = null;

function PathNode(x, y) {
    this.x = x;
    this.y = y;
};


function resize(evt) {
    reset_vector_field();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}

function reset_vector_field() {
    surface.vector_field = [];
    for (var y = 0; y < canvas.height; y++) {
        var row  = [];
        for (var x = 0; x < canvas.width; x++) {
            row.push({x:0, y:0});
        }
        surface.vector_field.push(row);
    }
}

function setup(evt) {
    console.log("Starting");
    canvas = document.getElementById("lightvim");
    ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener("resize", resize);

    // Set the font

    mode = command_mode;

    /* Install the proxy handlers */
    window.addEventListener("keypress", _key_handler);
    window.addEventListener("keyup", function(evt) { if (evt.keyCode == 27) {transition(command_mode);} });
    canvas.addEventListener("mousedown", _mousedown_handler);
    canvas.addEventListener("mousemove", _mousemove_handler);
    canvas.addEventListener("mouseup", _mouseup_handler);

    resize();
    draw();
}

var mode = null;

var surface = {
    "actions": [],
    "redo_stack": [],
    "state": "valid",
    "redraw": function() {

        for (var i = 0; i < this.actions.length; i++) {
            var action = this.actions[i];
            action.render();
        }

        surface.state = "valid";
    },

    "vector_field":  []
}

function draw_status(state) {
    var oldfill = ctx.fillStyle;
    ctx.fillStyle = "#FFF";
    ctx.font = "12pt Arial";
    ctx.fillText(state.mode, 5, canvas.height-20);
    ctx.fillStyle = oldfill;
}

function transition(new_mode) {
    mode = new_mode;
    surface.state = "invalid";
    draw();
};

function decode_keypress(evt) {
    return String.fromCharCode(evt.charCode);
}

function _key_handler(evt) {
    var actual_handler = mode.keys;
    if (actual_handler !== null) {
        actual_handler(evt);
    };
}

function _mousedown_handler(evt) {
    var handler = mode.mouse.down;
    if (handler) {
        handler(evt);
    }
};

function _mousemove_handler(evt) {
    var handler = mode.mouse.move;
    if (handler) {
        handler(evt);
    }
};

function _mouseup_handler(evt) {
    var handler = mode.mouse.up;
    if (handler) {
        handler(evt);
    }
};

function clear() {
    ctx.clearRect(0,0, canvas.width, canvas.height);
}

function draw() {
    clear();
    surface.redraw();
    draw_status(mode);
};

document.addEventListener("DOMContentLoaded", setup);
