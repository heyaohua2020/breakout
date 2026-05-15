extends Area2D
## 道具

var powerup_data: Dictionary = {}
var fall_speed: float = 80.0
var wobble: float = 0.0

func setup(data: Dictionary) -> void:
	powerup_data = data
	var c = Color(data.color)
	$ColorRect.color = c
	$Label.text = data.id

func _process(delta: float) -> void:
	position.y += fall_speed * delta
	wobble += delta * 4.0
	position.x += sin(wobble) * 0.5
	if position.y > 650:
		queue_free()

func _on_body_entered(body: Node) -> void:
	if body.is_in_group("paddle"):
		AudioManager.play_powerup()
		# 触发效果由 Game 场景处理
		queue_free()

func get_data() -> Dictionary:
	return powerup_data.duplicate()
