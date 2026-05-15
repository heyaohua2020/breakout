extends Area2D
## 挡板

signal caught_powerup(powerup_type: Dictionary)

@export var move_speed: float = 600.0
var default_width: float = 120.0
var target_x: float = 0.0
var _is_mouse_control: bool = false

func _ready() -> void:
	$CollisionShape2D.shape.size.x = default_width
	reset_position()

func _process(delta: float) -> void:
	var dir = Input.get_axis("ui_left", "ui_right")
	if dir != 0:
		_is_mouse_control = false
		position.x += dir * move_speed * delta
	elif _is_mouse_control and target_x > 0:
		var diff = target_x - position.x
		if abs(diff) > 2:
			position.x += sign(diff) * min(abs(diff), move_speed * delta * 2)
		else:
			position.x = target_x
	position.x = clamp(position.x, 64, 800 - 64)

func reset_position() -> void:
	position = Vector2(400, 570)

func set_width(w: float) -> void:
	$CollisionShape2D.shape.size.x = w
	$ColorRect.size.x = w

func reset_width() -> void:
	set_width(default_width)

func _on_mouse_entered() -> void:
	_is_mouse_control = true

func _on_mouse_exited() -> void:
	_is_mouse_control = false

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		target_x = event.position.x

func get_launch_position() -> Vector2:
	return Vector2(position.x, position.y - 14)

func get_hit_position(hit_x: float) -> float:
	return (hit_x - position.x) / ($CollisionShape2D.shape.size.x / 2)
