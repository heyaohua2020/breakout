extends Area2D
## 球 — 碰撞检测 + 物理

enum BallState { STUCK, FREE, GLUED }

var ball_state: BallState = BallState.STUCK
var velocity: Vector2 = Vector2.ZERO
var speed: float = 400.0
var default_speed: float = 400.0
var attached_paddle: Node = null
var trail_points: Array = []

signal hit_paddle(hit_x: float)
signal hit_brick(brick_node: Node)
signal hit_wall(side: String)
signal fell_off()

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)

func _process(delta: float) -> void:
	match ball_state:
		BallState.STUCK, BallState.GLUED:
			if attached_paddle:
				position = attached_paddle.get_launch_position()
		BallState.FREE:
			position += velocity * delta
			trail_points.push_front(position)
			if trail_points.size() > 8: trail_points.pop_back()
			# 墙壁边界
			if position.x - 9 <= 0:
				position.x = 9
				velocity.x = abs(velocity.x)
			if position.x + 9 >= 800:
				position.x = 791
				velocity.x = -abs(velocity.x)
			if position.y - 9 <= 0:
				position.y = 9
				velocity.y = abs(velocity.y)
			if position.y - 9 > 600:
				fell_off.emit()

func _on_body_entered(body: Node) -> void:
	if ball_state != BallState.FREE: return
	if body.is_in_group("bricks"):
		hit_brick.emit(body)
	if body.is_in_group("walls"):
		var d = (position - body.position).normalized()
		if abs(d.x) > abs(d.y):
			velocity.x = -velocity.x
		else:
			velocity.y = -velocity.y

func _on_area_entered(area: Node) -> void:
	if ball_state != BallState.FREE: return
	if area.is_in_group("paddle"):
		hit_paddle.emit(area.position.x)
	if area.is_in_group("bottom"):
		fell_off.emit()

func launch(angle_offset: float = 0.8) -> void:
	if ball_state == BallState.STUCK or ball_state == BallState.GLUED:
		ball_state = BallState.FREE
		var angle = -PI / 2 + (randf() - 0.5) * angle_offset
		velocity = Vector2(cos(angle), sin(angle)) * speed
		trail_points.clear()

func glue_to_paddle() -> void:
	ball_state = BallState.GLUED
	velocity = Vector2.ZERO
	trail_points.clear()

func set_speed_mult(factor: float) -> void:
	speed = default_speed * factor
	if ball_state == BallState.FREE and velocity.length() > 0:
		velocity = velocity.normalized() * speed

func is_stuck() -> bool:
	return ball_state == BallState.STUCK or ball_state == BallState.GLUED
