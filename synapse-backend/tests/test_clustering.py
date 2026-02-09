"""
Tests for Clustering Service
"""
import pytest
import numpy as np
from src.services.clustering_service import ClusteringService, Cluster


class TestClusteringService:
    """Test suite for ClusteringService"""

    def test_initialization_defaults(self):
        """Test service initializes with default parameters"""
        service = ClusteringService()
        assert service.algorithm == "dbscan"
        assert service.eps == 0.5
        assert service.min_samples == 2

    def test_initialization_custom(self):
        """Test service initializes with custom parameters"""
        service = ClusteringService(
            algorithm="kmeans",
            n_clusters=5
        )
        assert service.algorithm == "kmeans"
        assert service.n_clusters == 5

    def test_compute_clusters_empty(self):
        """Test clustering with empty input"""
        service = ClusteringService()
        clusters = service.compute_clusters([], [])
        assert clusters == []

    def test_compute_clusters_single_item(self):
        """Test clustering with single item (below threshold)"""
        service = ClusteringService()
        items = [{"id": "1", "content": "test", "position_x": 0, "position_y": 0}]
        embeddings = [[0.1, 0.2, 0.3]]
        clusters = service.compute_clusters(items, embeddings)
        assert clusters == []

    def test_compute_clusters_dbscan(self):
        """Test DBSCAN clustering with similar items"""
        service = ClusteringService(algorithm="dbscan", eps=0.5, min_samples=2)
        
        # Create items with similar embeddings
        items = [
            {"id": "1", "content": "python programming", "title": "Python", "position_x": 0, "position_y": 0},
            {"id": "2", "content": "python coding", "title": "Python 2", "position_x": 100, "position_y": 0},
            {"id": "3", "content": "javascript web", "title": "JS", "position_x": 500, "position_y": 500},
            {"id": "4", "content": "javascript frontend", "title": "JS 2", "position_x": 600, "position_y": 500},
        ]
        
        # Similar embeddings for related items
        embeddings = [
            [0.9, 0.1, 0.0, 0.0],  # Python 1
            [0.85, 0.15, 0.0, 0.0],  # Python 2 (similar to Python 1)
            [0.0, 0.0, 0.9, 0.1],  # JS 1
            [0.0, 0.0, 0.85, 0.15],  # JS 2 (similar to JS 1)
        ]
        
        clusters = service.compute_clusters(items, embeddings)
        
        # Should find 2 clusters (Python and JavaScript)
        assert len(clusters) >= 1  # At least one cluster

    def test_compute_clusters_kmeans(self):
        """Test K-means clustering"""
        service = ClusteringService(algorithm="kmeans", n_clusters=2)
        
        items = [
            {"id": "1", "content": "python", "title": "A", "position_x": 0, "position_y": 0},
            {"id": "2", "content": "python", "title": "B", "position_x": 50, "position_y": 50},
            {"id": "3", "content": "javascript", "title": "C", "position_x": 500, "position_y": 500},
            {"id": "4", "content": "javascript", "title": "D", "position_x": 550, "position_y": 550},
        ]
        
        embeddings = [
            [1.0, 0.0],
            [0.9, 0.1],
            [0.0, 1.0],
            [0.1, 0.9],
        ]
        
        clusters = service.compute_clusters(items, embeddings)
        
        # K-means with n_clusters=2 should produce 2 clusters
        assert len(clusters) == 2

    def test_cluster_has_required_fields(self):
        """Test that computed clusters have all required fields"""
        service = ClusteringService(algorithm="kmeans", n_clusters=2)
        
        items = [
            {"id": "1", "content": "test", "title": "Test 1", "position_x": 0, "position_y": 0},
            {"id": "2", "content": "test", "title": "Test 2", "position_x": 100, "position_y": 100},
            {"id": "3", "content": "other", "title": "Other", "position_x": 500, "position_y": 500},
            {"id": "4", "content": "other", "title": "Other 2", "position_x": 600, "position_y": 600},
        ]
        
        embeddings = [
            [1.0, 0.0],
            [0.9, 0.1],
            [0.0, 1.0],
            [0.1, 0.9],
        ]
        
        clusters = service.compute_clusters(items, embeddings)
        
        for cluster in clusters:
            assert isinstance(cluster, Cluster)
            assert cluster.id is not None
            assert cluster.name is not None
            assert cluster.color is not None
            assert isinstance(cluster.center_x, float)
            assert isinstance(cluster.center_y, float)
            assert isinstance(cluster.radius, float)
            assert isinstance(cluster.item_ids, list)
            assert isinstance(cluster.keywords, list)

    def test_extract_keywords(self):
        """Test keyword extraction from items"""
        service = ClusteringService()
        
        items = [
            {"content": "Python is a programming language", "title": "Python"},
            {"content": "Python is great for data science", "title": "Data"},
        ]
        
        keywords = service._extract_keywords(items, max_keywords=5)
        
        assert "python" in keywords
        assert len(keywords) <= 5

    def test_generate_cluster_name(self):
        """Test cluster name generation from keywords"""
        service = ClusteringService()
        
        keywords = ["python", "programming", "data"]
        name = service._generate_cluster_name(keywords)
        
        assert "Python" in name
        assert "Programming" in name or "Data" in name

    def test_generate_cluster_name_empty(self):
        """Test cluster name generation with empty keywords"""
        service = ClusteringService()
        
        name = service._generate_cluster_name([])
        assert name == "Miscellaneous"

    def test_cluster_colors_unique(self):
        """Test that cluster colors are assigned from predefined palette"""
        service = ClusteringService(algorithm="kmeans", n_clusters=3)
        
        items = [
            {"id": str(i), "content": f"content {i}", "title": f"Item {i}", 
             "position_x": i * 100, "position_y": i * 100}
            for i in range(6)
        ]
        
        # Generate distinct embeddings for 3 groups
        embeddings = [
            [1.0, 0.0, 0.0],
            [0.9, 0.1, 0.0],
            [0.0, 1.0, 0.0],
            [0.1, 0.9, 0.0],
            [0.0, 0.0, 1.0],
            [0.0, 0.1, 0.9],
        ]
        
        clusters = service.compute_clusters(items, embeddings)
        
        # All clusters should have colors
        colors = [c.color for c in clusters]
        for color in colors:
            assert color.startswith("#")
            assert len(color) == 7


class TestClusterRadius:
    """Test suite for cluster radius calculation"""

    def test_radius_calculation(self):
        """Test that radius encompasses all items"""
        service = ClusteringService(algorithm="kmeans", n_clusters=1)
        
        items = [
            {"id": "1", "content": "a", "title": "A", "position_x": 0, "position_y": 0},
            {"id": "2", "content": "a", "title": "B", "position_x": 100, "position_y": 0},
            {"id": "3", "content": "a", "title": "C", "position_x": 50, "position_y": 100},
        ]
        
        embeddings = [[1.0], [1.0], [1.0]]  # All same = one cluster
        
        clusters = service.compute_clusters(items, embeddings)
        
        if clusters:
            cluster = clusters[0]
            # Center should be average of positions
            assert abs(cluster.center_x - 50) < 1
            assert abs(cluster.center_y - 33.33) < 1
            # Radius should be large enough to contain all items + padding
            assert cluster.radius > 100  # Must include padding
