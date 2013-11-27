function command_mode_keys(evt) {
    /* Key dispatcher for when we're in command mode. A mode transition swaps
     * out all the event handlers on the canvas. */
    var key = decode_keypress(evt);

    switch(key) {
        case "i":
            transition(insert_mode);
            return;
        case "u":
            undo_paint();
            return;
        case "U":
            redo_paint();
            return;
        default:
            return;
    }
}

function default_keys(evt) {
    /* Do nothing with keys until they escape out, then go back to command mode */
    var key = decode_keypress(evt);

    switch(key) {
        case "esc":
            transition(command_mode);
            return;
        default:
            return;
    }
}

function undo_paint() {
    if (!surface.actions.length) {
        return;
    }
    var action = surface.actions.pop();
    surface.redo_stack.push(action); 
    draw();
}

function redo_paint() {
    if (!surface.redo_stack.length) {
        return;
    }
    var action = surface.redo_stack.pop();
    surface.actions.push(action);
    draw();
}

function insert_keys(evt) {
    var key = decode_keypress(evt);
    switch(key) {
        case "u":
            undo_paint();
            return;
        case "U":
            redo_paint();
            return;
        case "+":
            increase_width();
            return;
        case "-":
            decrease_width();
            return;
        case "=":
            reset_width();
            return;
        default:
            return
        //    return default_keys(evt);
    }
}

function reset_width() {
    current_line_width = 3;
}

function increase_width() {
    if (current_line_width < 10) {
        current_line_width++;
    }
}

function decrease_width() {
    if (current_line_width > 1) {
        current_line_width--;
    }
}

var command_mode = {
    'mode': '',
    'keys': command_mode_keys,
    'mouse': {},
    'touch': null
}


var drawing = false;
var current_action = [];

var current_line_width = 3;
var current_line_style = "#FFF";

function reset_redo_stack() {
    surface.redo_stack = [];
}

function new_line_path(start_x, start_y) {
    return {
        "width": current_line_width,
        "style": current_line_style,
        "segments": [{"x": start_x, "y": start_y}],

        "push": function(item) {
            this.segments.push({"x": item.x, "y": item.y});
        },

        "render": function() {
            ctx.beginPath();
            ctx.lineWidth = this.width;
            ctx.strokeStyle = this.style;
            var start = this.segments[0];
            ctx.moveTo(start.x, start.y);
            for (var i = 0; i < this.segments.length; i++) {
                var segment = this.segments[i];
                ctx.lineTo(segment.x, segment.y);
            }
            ctx.stroke();
        },

        "close": function() {
        }
    }
}

function new_bezier_path(start_x, start_y) {
    // Initialize the vector field
    var FIELD_RADIUS = 20;
    var MAX_ERROR = 3;
    var NUM_SAMPLE_POINTS = 30;
    var MAX_ITER = 4;

    function new_vector_field() {
        var vector_field = [];
        for (var y = 0; y < canvas.height; y++) {
            var row  = [];
            for (var x = 0; x < canvas.width; x++) {
                row.push({x:0, y:0});
            }
            vector_field.push(row);
        }

        return vector_field;
    }

    var vector_field = new_vector_field();

    function init_curve(x, y) {
        return {"c0": {"x": x, "y": y},
                "c1": {"x": x, "y": y},
                "c2": {"x": x, "y": y},
                "c3": {"x": x, "y": y}}
    }

    function bezier(seg, t) {
        // bezier calculation, t is the percentage progress along the curve
        // returns a float
        var x, y;
        x = seg.c0.x * (1 - t) * (1 - t) * (1 - t) +
        3 * seg.c1.x * t * (1 - t) * (1 - t) +
        3 * seg.c2.x * t * t * (1 - t) +
            seg.c3.x * t * t * t;

        y = seg.c0.y * (1 - t) * (1 - t) * (1 - t) +
        3 * seg.c1.y * t * (1 - t) * (1 - t) +
        3 * seg.c2.y * t * t * (1 - t) +
            seg.c3.y * t * t * t;

        var vals = {"x": x, "y": y};
        return vals;

    }

    function vec_length(v) {
        return Math.sqrt((v.x*v.x) + (v.y*v.y));
    }

    function field_strength(x, y) {
        // Given the vector field, get the interpolated value given the floating point coordinates
        var low_x = Math.floor(x), low_y = Math.floor(y);
        var dx = x-low_x, dy = y-low_y;
        var high_x = low_x + 1, high_y = low_y + 1;

        // linearly interpolate the value at (x, y) based on the bounding box around it
        var tl = vector_field[low_y][low_x];
        var tr = vector_field[low_y][high_x];
        var bl = vector_field[high_y][low_x];
        var br = vector_field[high_y][high_x];

        var new_x = tl.x * (1-dx) * (1-dy) +
                    tr.x * dx * (1-dy) +
                    bl.x * (1-dx) * dy +
                    br.x * dx * dy;

        var new_y = tl.y * (1-dx) * (1-dy) +
                    tr.y * dx * (1-dy) +
                    bl.y * (1-dx) * dy +
                    br.y * dx * dy;

        var results = {"x": new_x, "y": new_y};
        return results;
    }

    function update_vector_field(segment) {
        render_line_cell(segment);
        render_point_cell(segment);
    }

    function update_segment(x, y, segment) {
        // Ignore corners for now

        // Update the endpoint of the segment
        var xprev = segment.c3.x;
        var yprev = segment.c3.y;

        segment.c3.x = x;
        segment.c3.y = y;

        segment.c2.x += (x - xprev);
        segment.c2.y += (y - yprev);

        update_vector_field(segment);

        var f1 = null, v2 = null;
        var N = NUM_SAMPLE_POINTS;

        var d = null, dp = {'x': 5, 'y': 5};

        var n_iter = 0;
        var error = 1000;
        // Iteratively shuffle the segment points until error is reduced
        while (error > MAX_ERROR && n_iter < MAX_ITER) {
            f1 = {"x": 0, "y": 0};
            f2 = {"x": 0, "y": 0};

            for (var i = 0; i < N; i++) {
                var t_i = i/N;
                // Bezier returns a floating point coordinate
                var p = bezier(segment, t_i);
                // We use this to accurately get the field strength at a subpixel level
                dp = field_strength(p.x, p.y);
                d = vec_length(dp);

                if (error == 1000) {
                    error = 0;
                }

                error += d;

                f1.x += 6 * t_i * (1-t_i)*(1-t_i) * d * dp.x/N;
                f1.y += 6 * t_i * (1-t_i)*(1-t_i) * d * dp.y/N;
                f2.x += 6 * t_i * t_i * (1-t_i) * d * dp.x/N;
                f2.y += 6 * t_i * t_i * (1-t_i) * d * dp.y/N;
            }

            segment.c1.x += f1.x;
            segment.c1.y += f1.y;

            segment.c2.x += f2.x;
            segment.c2.y += f2.y;

            if (error < MAX_ERROR) {
                return true;
            }
            n_iter++;
        }

        return true;
    }

    function render_line_cell(segment) {
    }

    function render_point_cell(segment) {
        var x = segment.c0.x;
        var y = segment.c0.y;

        var bot = Math.min(y+1+FIELD_RADIUS, canvas.height-1);
        var left = Math.max(0, x-1-FIELD_RADIUS);
        var right = Math.min(canvas.width-1, x+1+FIELD_RADIUS);
        var top_ = Math.max(0, y-1-FIELD_RADIUS);

        for (var x_iter = left; x_iter <= right; x_iter++) {
            for (var y_iter = top_; y_iter <= bot; y_iter++) {
                vector_field[y_iter][x_iter].x = x - x_iter;
                vector_field[y_iter][x_iter].y = y - y_iter;
            }
        }

    }

    return {
        "segments": [ init_curve(start_x, start_y) ],
        "push": function(item) {
            var x = item.x;
            var y = item.y;

            var last_segment = this.segments[this.segments.length-1];

            if (!update_segment(x, y, last_segment)) {
                // If we fail to update the segment, then we need to make a new segment
            }
        },

        "render": function() {
            for (var i = 0; i < this.segments.length; i++) {
                var seg = this.segments[i];
                ctx.beginPath();
                ctx.moveTo(seg.c0.x, seg.c0.y);
                ctx.bezierCurveTo(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.c3.x, seg.c3.y);
                ctx.stroke();
            }
        },

        "close": function() {
            this.vector_field = null;
        }
    }
}

var draw_tool = new_line_path;

function paint_begin(evt) {
    reset_redo_stack();
    reset_vector_field();
    var x = evt.x;
    var y = evt.y;
    drawing = true;
    current_action = draw_tool(x, y)
}

function paint_move(evt) {
    if (!drawing) {
        return;
    }
    var x = evt.x;
    var y = evt.y;

    draw();
    current_action.push({'x':x,'y': y});
    current_action.render()
}

function paint_end(evt) {
    if (!drawing) {
        return;
    }

    var x = evt.x;
    var y = evt.y;
    current_action.push({"x": x, "y": y});
    surface.actions.push(current_action);
    current_action.close();
    current_action = null;
    drawing = false;
    draw();
}

var insert_mode = {
    'mode': '-- Insert --',
    'keys': insert_keys,
    'mouse': {"down": paint_begin,
              "up": paint_end,
              "move": paint_move },
    'touch': null
}


