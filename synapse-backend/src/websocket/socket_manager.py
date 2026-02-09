"""
WebSocket Manager for Synapse
Handles real-time collaboration and physics sync
"""
import socketio
from typing import Dict, List, Set
import asyncio
import json
from datetime import datetime


class SocketManager:
    """
    Manages WebSocket connections for real-time collaboration.
    Handles:
    - User connections/disconnections
    - Room-based collaboration (workspaces)
    - Physics state broadcasting
    - Item updates sync
    """
    
    def __init__(self):
        # Create Socket.IO server
        self.sio = socketio.AsyncServer(
            async_mode='asgi',
            cors_allowed_origins='*',
            ping_timeout=60,
            ping_interval=25
        )
        
        # Track connected users per workspace
        self.workspace_users: Dict[str, Set[str]] = {}
        
        # Track user info
        self.user_info: Dict[str, Dict] = {}
        
        # Physics update loop
        self.physics_task = None
        self.is_running = False
    
    def get_asgi_app(self):
        """Get the ASGI application for mounting"""
        return socketio.ASGIApp(self.sio)
    
    async def start_physics_loop(self, physics_engine, broadcast_interval: float = 0.033):
        """
        Start the physics simulation loop.
        
        Args:
            physics_engine: The physics engine instance
            broadcast_interval: Seconds between physics updates (30 FPS)
        """
        self.is_running = True
        
        while self.is_running:
            try:
                # Run physics step
                updates = physics_engine.step()
                
                # Broadcast to all workspaces
                for workspace_id in self.workspace_users.keys():
                    await self.sio.emit(
                        'physics_update',
                        {'updates': updates, 'timestamp': datetime.utcnow().isoformat()},
                        room=workspace_id
                    )
                
                await asyncio.sleep(broadcast_interval)
            except Exception as e:
                print(f"Physics loop error: {e}")
                await asyncio.sleep(broadcast_interval)
    
    def stop_physics_loop(self):
        """Stop the physics simulation loop"""
        self.is_running = False
    
    def register_handlers(self):
        """Register all Socket.IO event handlers"""
        
        @self.sio.event
        async def connect(sid, environ):
            """Handle new connection"""
            print(f"Client connected: {sid}")
            self.user_info[sid] = {
                'connected_at': datetime.utcnow().isoformat(),
                'workspace_id': None
            }
        
        @self.sio.event
        async def disconnect(sid):
            """Handle disconnection"""
            print(f"Client disconnected: {sid}")
            
            # Remove from workspace
            workspace_id = self.user_info.get(sid, {}).get('workspace_id')
            if workspace_id and workspace_id in self.workspace_users:
                self.workspace_users[workspace_id].discard(sid)
                
                # Notify others
                await self.sio.emit(
                    'user_left',
                    {'user_id': sid},
                    room=workspace_id,
                    skip_sid=sid
                )
            
            # Clean up
            if sid in self.user_info:
                del self.user_info[sid]
        
        @self.sio.event
        async def join_workspace(sid, data):
            """User joins a workspace"""
            workspace_id = data.get('workspace_id')
            user_name = data.get('user_name', 'Anonymous')
            
            if not workspace_id:
                return {'error': 'workspace_id required'}
            
            # Leave previous workspace
            old_workspace = self.user_info.get(sid, {}).get('workspace_id')
            if old_workspace and old_workspace in self.workspace_users:
                self.workspace_users[old_workspace].discard(sid)
                await self.sio.leave_room(sid, old_workspace)
            
            # Join new workspace
            await self.sio.enter_room(sid, workspace_id)
            
            if workspace_id not in self.workspace_users:
                self.workspace_users[workspace_id] = set()
            self.workspace_users[workspace_id].add(sid)
            
            # Update user info
            self.user_info[sid]['workspace_id'] = workspace_id
            self.user_info[sid]['user_name'] = user_name
            
            # Notify others
            await self.sio.emit(
                'user_joined',
                {
                    'user_id': sid,
                    'user_name': user_name,
                    'timestamp': datetime.utcnow().isoformat()
                },
                room=workspace_id,
                skip_sid=sid
            )
            
            # Return current users in workspace
            other_users = [
                {
                    'user_id': uid,
                    'user_name': self.user_info.get(uid, {}).get('user_name', 'Anonymous')
                }
                for uid in self.workspace_users[workspace_id]
                if uid != sid
            ]
            
            return {
                'success': True,
                'workspace_id': workspace_id,
                'other_users': other_users
            }
        
        @self.sio.event
        async def leave_workspace(sid, data):
            """User leaves a workspace"""
            workspace_id = data.get('workspace_id')
            
            if workspace_id and workspace_id in self.workspace_users:
                self.workspace_users[workspace_id].discard(sid)
                await self.sio.leave_room(sid, workspace_id)
                
                await self.sio.emit(
                    'user_left',
                    {'user_id': sid},
                    room=workspace_id,
                    skip_sid=sid
                )
            
            self.user_info[sid]['workspace_id'] = None
            
            return {'success': True}
        
        @self.sio.event
        async def item_created(sid, data):
            """Broadcast new item creation"""
            workspace_id = self.user_info.get(sid, {}).get('workspace_id')
            if workspace_id:
                await self.sio.emit(
                    'item_created',
                    {
                        'item': data.get('item'),
                        'created_by': sid,
                        'timestamp': datetime.utcnow().isoformat()
                    },
                    room=workspace_id,
                    skip_sid=sid
                )
        
        @self.sio.event
        async def item_updated(sid, data):
            """Broadcast item update"""
            workspace_id = self.user_info.get(sid, {}).get('workspace_id')
            if workspace_id:
                await self.sio.emit(
                    'item_updated',
                    {
                        'item_id': data.get('item_id'),
                        'updates': data.get('updates'),
                        'updated_by': sid,
                        'timestamp': datetime.utcnow().isoformat()
                    },
                    room=workspace_id,
                    skip_sid=sid
                )
        
        @self.sio.event
        async def item_deleted(sid, data):
            """Broadcast item deletion"""
            workspace_id = self.user_info.get(sid, {}).get('workspace_id')
            if workspace_id:
                await self.sio.emit(
                    'item_deleted',
                    {
                        'item_id': data.get('item_id'),
                        'deleted_by': sid,
                        'timestamp': datetime.utcnow().isoformat()
                    },
                    room=workspace_id,
                    skip_sid=sid
                )
        
        @self.sio.event
        async def item_moved(sid, data):
            """Handle item being dragged by user"""
            workspace_id = self.user_info.get(sid, {}).get('workspace_id')
            if workspace_id:
                await self.sio.emit(
                    'item_moved',
                    {
                        'item_id': data.get('item_id'),
                        'x': data.get('x'),
                        'y': data.get('y'),
                        'moved_by': sid,
                        'timestamp': datetime.utcnow().isoformat()
                    },
                    room=workspace_id,
                    skip_sid=sid
                )
        
        @self.sio.event
        async def cursor_move(sid, data):
            """Broadcast cursor position for presence"""
            workspace_id = self.user_info.get(sid, {}).get('workspace_id')
            if workspace_id:
                await self.sio.emit(
                    'cursor_move',
                    {
                        'user_id': sid,
                        'user_name': self.user_info.get(sid, {}).get('user_name', 'Anonymous'),
                        'x': data.get('x'),
                        'y': data.get('y'),
                        'timestamp': datetime.utcnow().isoformat()
                    },
                    room=workspace_id,
                    skip_sid=sid
                )
        
        @self.sio.event
        async def request_neighbors(sid, data):
            """Request nearest neighbors for tether effect"""
            workspace_id = self.user_info.get(sid, {}).get('workspace_id')
            if workspace_id:
                # This will be handled by the main app
                pass
    
    async def broadcast_to_workspace(self, workspace_id: str, event: str, data: dict):
        """Broadcast an event to all users in a workspace"""
        await self.sio.emit(event, data, room=workspace_id)
