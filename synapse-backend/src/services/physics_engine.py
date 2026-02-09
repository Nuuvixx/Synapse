"""
Physics Engine for Synapse
Simulates gravitational attraction based on semantic similarity
"""
from typing import List, Dict, Any, Tuple
import numpy as np
from dataclasses import dataclass
import math


@dataclass
class PhysicsBody:
    """Represents a physical body in the simulation"""
    id: str
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0
    mass: float = 1.0
    radius: float = 40.0
    embedding: List[float] = None
    cluster_id: str = None


class PhysicsEngine:
    """
    Physics simulation for Synapse workspace.
    Implements:
    - Gravitational attraction based on semantic similarity
    - Repulsion to prevent overlap
    - Damping for smooth movement
    - Cluster-based forces
    """
    
    def __init__(self):
        # Force constants
        self.gravity_strength = 5000.0  # Base gravitational pull
        self.repulsion_strength = 2000.0  # Repulsion force
        self.similarity_threshold = 0.7  # Minimum similarity for attraction
        self.max_attraction_distance = 800.0  # Max distance for attraction
        self.min_repulsion_distance = 100.0  # Distance for max repulsion
        
        # Physics parameters
        self.damping = 0.80  # Increased friction (was 0.92) to stop drifting
        self.max_velocity = 15.0  # Maximum velocity cap
        self.time_step = 0.016  # 60 FPS
        
        # Cluster parameters
        self.cluster_gravity = 0.5  # Additional pull toward cluster center
        
        # Bodies in simulation
        self.bodies: Dict[str, PhysicsBody] = {}
    
    def add_body(self, body: PhysicsBody):
        """Add a body to the physics simulation"""
        self.bodies[body.id] = body
    
    def remove_body(self, body_id: str):
        """Remove a body from the simulation"""
        if body_id in self.bodies:
            del self.bodies[body_id]
    
    def update_body_position(self, body_id: str, x: float, y: float):
        """Update a body's position (e.g., from user drag)"""
        if body_id in self.bodies:
            self.bodies[body_id].x = x
            self.bodies[body_id].y = y
            self.bodies[body_id].vx = 0
            self.bodies[body_id].vy = 0
    
    def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Compute cosine similarity between two embeddings"""
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        vec1_norm = vec1 / (np.linalg.norm(vec1) + 1e-8)
        vec2_norm = vec2 / (np.linalg.norm(vec2) + 1e-8)
        
        similarity = np.dot(vec1_norm, vec2_norm)
        return float((similarity + 1) / 2)
    
    def compute_forces(self, body: PhysicsBody) -> Tuple[float, float]:
        """
        Compute net force on a body from all other bodies.
        
        Returns:
            Tuple of (fx, fy) force components
        """
        fx, fy = 0.0, 0.0
        
        for other_id, other in self.bodies.items():
            if other_id == body.id:
                continue
            
            # Distance between bodies
            dx = other.x - body.x
            dy = other.y - body.y
            distance = math.sqrt(dx * dx + dy * dy)
            
            if distance < 1.0:
                distance = 1.0
            
            # Unit vector
            ux = dx / distance
            uy = dy / distance
            
            # REPULSION: Prevent overlap
            if distance < self.min_repulsion_distance:
                repulsion_force = self.repulsion_strength * (1 - distance / self.min_repulsion_distance)
                fx -= ux * repulsion_force
                fy -= uy * repulsion_force
            
            # ATTRACTION: Based on semantic similarity
            if (body.embedding and other.embedding and 
                distance < self.max_attraction_distance):
                
                similarity = self.compute_similarity(body.embedding, other.embedding)
                
                if similarity > self.similarity_threshold:
                    # Attraction force proportional to similarity
                    attraction_force = (
                        self.gravity_strength * 
                        (similarity - self.similarity_threshold) / 
                        (1 - self.similarity_threshold) *
                        (1 - distance / self.max_attraction_distance)
                    )
                    fx += ux * attraction_force
                    fy += uy * attraction_force
        
        return fx, fy
    
    def step(self) -> Dict[str, Dict[str, float]]:
        """
        Perform one physics simulation step.
        
        Returns:
            Dict mapping body IDs to their new positions
        """
        updates = {}
        
        for body_id, body in self.bodies.items():
            # Compute forces
            fx, fy = self.compute_forces(body)
            
            # Apply force (F = ma, so a = F/m)
            ax = fx / body.mass
            ay = fy / body.mass
            
            # Update velocity
            body.vx += ax * self.time_step
            body.vy += ay * self.time_step
            
            # Apply damping
            body.vx *= self.damping
            body.vy *= self.damping
            
            # Cap velocity and Stop if slow
            velocity = math.sqrt(body.vx * body.vx + body.vy * body.vy)
            if velocity < 0.1:
                body.vx = 0.0
                body.vy = 0.0
            elif velocity > self.max_velocity:
                scale = self.max_velocity / velocity
                body.vx *= scale
                body.vy *= scale
            
            # Update position
            body.x += body.vx * self.time_step * 60  # Scale for visibility
            body.y += body.vy * self.time_step * 60
            
            # Store update
            updates[body_id] = {
                "x": body.x,
                "y": body.y,
                "vx": body.vx,
                "vy": body.vy
            }
        
        return updates
    
    def get_nearest_neighbors(
        self, 
        body_id: str, 
        max_distance: float = 500.0,
        min_similarity: float = 0.6
    ) -> List[Dict[str, Any]]:
        """
        Get nearest neighbors for a body based on distance and similarity.
        
        Returns:
            List of neighbor info with similarity scores
        """
        if body_id not in self.bodies:
            return []
        
        body = self.bodies[body_id]
        neighbors = []
        
        for other_id, other in self.bodies.items():
            if other_id == body_id:
                continue
            
            dx = other.x - body.x
            dy = other.y - body.y
            distance = math.sqrt(dx * dx + dy * dy)
            
            if distance > max_distance:
                continue
            
            similarity = 0.0
            if body.embedding and other.embedding:
                similarity = self.compute_similarity(body.embedding, other.embedding)
            
            if similarity >= min_similarity:
                neighbors.append({
                    "id": other_id,
                    "distance": distance,
                    "similarity": similarity,
                    "x": other.x,
                    "y": other.y
                })
        
        # Sort by similarity
        neighbors.sort(key=lambda n: n["similarity"], reverse=True)
        return neighbors
    
    def suggest_position_for_new_item(
        self, 
        embedding: List[float],
        existing_items: List[Dict[str, Any]]
    ) -> Tuple[float, float]:
        """
        Suggest a position for a new item based on semantic similarity.
        The item should be placed near similar items.
        
        Returns:
            Suggested (x, y) position
        """
        if not existing_items:
            return 0.0, 0.0
        
        # Compute similarities
        similarities = []
        for item in existing_items:
            if item.get("embedding"):
                sim = self.compute_similarity(embedding, item["embedding"])
                similarities.append((item, sim))
        
        if not similarities:
            return 0.0, 0.0
        
        # Sort by similarity
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Take top 3 most similar
        top_similar = similarities[:3]
        
        # Weighted average position
        total_weight = 0.0
        x_sum = 0.0
        y_sum = 0.0
        
        for item, similarity in top_similar:
            weight = similarity ** 2  # Square to emphasize high similarity
            x_sum += item["position_x"] * weight
            y_sum += item["position_y"] * weight
            total_weight += weight
        
        if total_weight > 0:
            # Add some randomness to avoid exact overlap
            import random
            x = x_sum / total_weight + random.uniform(-50, 50)
            y = y_sum / total_weight + random.uniform(-50, 50)
            return x, y
        
        return 0.0, 0.0
