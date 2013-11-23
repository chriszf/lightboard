var canvas = document.getElementById("drawing_surface");
var ctx = canvas.getContext("2d");


function PathNode(x, y) {
    this.x = x;
    this.y = y;
};

function draw(path) {
    console.log(path);
    var current_node = path[0];
    console.log(current_node);
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FFF";
    for (var i = 1; i < path.length; i++) {
        var next_node = path[i];

        ctx.moveTo(current_node.x, current_node.y);
        ctx.bezierCurveTo(current_node.x,
                          current_node.y,
                          next_node.x,
                          next_node.y,
                          next_node.x,
                          next_node.y);
    }

    ctx.stroke();
}

function setup() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};

p1 = new PathNode(0, 0);
p2 = new PathNode(100, 100);

setup();
draw([p1, p2]);

