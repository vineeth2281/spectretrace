# Map configurations for coordinate conversion
MAP_CONFIGS = {
    "AmbroseValley": {
        "scale": 900.0,
        "origin_x": -370.0,
        "origin_z": -473.0,
        "width": 1024,
        "height": 1024
    },
    "GrandRift": {
        "scale": 581.0,
        "origin_x": -290.0,
        "origin_z": -290.0,
        "width": 1024,
        "height": 1024
    },
    "Lockdown": {
        "scale": 1000.0,
        "origin_x": -500.0,
        "origin_z": -500.0,
        "width": 1024,
        "height": 1024
    }
}

def world_to_minimap(x: float, z: float, map_id: str) -> tuple[float, float]:
    """
    Converts 3D world coordinates (x, z) to 2D pixel coordinates on the 1024x1024 minimap image.
    Following formula from README:
    u = (x - origin_x) / scale
    v = (z - origin_z) / scale
    pixel_x = u * 1024
    pixel_y = (1 - v) * 1024
    """
    config = MAP_CONFIGS.get(map_id)
    if not config:
        # Fallback to AmbroseValley if map_id is unrecognized
        config = MAP_CONFIGS["AmbroseValley"]
        
    scale = config["scale"]
    origin_x = config["origin_x"]
    origin_z = config["origin_z"]
    
    u = (x - origin_x) / scale
    v = (z - origin_z) / scale
    
    pixel_x = u * 1024
    pixel_y = (1.0 - v) * 1024
    
    return pixel_x, pixel_y
