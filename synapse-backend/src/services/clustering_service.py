"""
Clustering Service for Semantic Grouping
Uses DBSCAN/K-means to group items by embedding similarity
"""
import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler
import os


@dataclass
class Cluster:
    """Represents a semantic cluster of items"""
    id: str
    name: str
    color: str
    center_x: float
    center_y: float
    radius: float
    item_ids: List[str]
    keywords: List[str]


# Predefined cluster colors (vibrant, distinct)
CLUSTER_COLORS = [
    "#FF6B6B",  # Coral Red
    "#4ECDC4",  # Teal
    "#45B7D1",  # Sky Blue
    "#96CEB4",  # Sage Green
    "#FFEAA7",  # Soft Yellow
    "#DDA0DD",  # Plum
    "#98D8C8",  # Mint
    "#F7DC6F",  # Gold
    "#BB8FCE",  # Lavender
    "#85C1E9",  # Light Blue
]


class ClusteringService:
    """Service for computing semantic clusters from item embeddings"""
    
    def __init__(
        self,
        algorithm: str = "dbscan",
        eps: float = 0.5,
        min_samples: int = 2,
        n_clusters: Optional[int] = None
    ):
        """
        Initialize clustering service
        
        Args:
            algorithm: 'dbscan' or 'kmeans'
            eps: DBSCAN epsilon (max distance between samples)
            min_samples: DBSCAN min samples per cluster
            n_clusters: Number of clusters for K-means (auto if None)
        """
        self.algorithm = algorithm
        self.eps = eps
        self.min_samples = min_samples
        self.n_clusters = n_clusters
    
    def compute_clusters(
        self,
        items: List[Dict],
        embeddings: List[List[float]]
    ) -> List[Cluster]:
        """
        Compute semantic clusters from item embeddings
        
        Args:
            items: List of item dictionaries with 'id', 'content', 'position_x', 'position_y'
            embeddings: Corresponding embedding vectors
            
        Returns:
            List of Cluster objects
        """
        if len(items) < 2 or len(embeddings) < 2:
            return []
        
        # Convert to numpy array
        X = np.array(embeddings)
        
        # Normalize embeddings
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Perform clustering
        if self.algorithm == "dbscan":
            labels = self._dbscan_cluster(X_scaled)
        else:
            labels = self._kmeans_cluster(X_scaled, len(items))
        
        # Group items by cluster
        clusters = self._build_clusters(items, labels)
        
        return clusters
    
    def _dbscan_cluster(self, X: np.ndarray) -> np.ndarray:
        """Run DBSCAN clustering"""
        clusterer = DBSCAN(
            eps=self.eps,
            min_samples=self.min_samples,
            metric='cosine'
        )
        return clusterer.fit_predict(X)
    
    def _kmeans_cluster(self, X: np.ndarray, n_items: int) -> np.ndarray:
        """Run K-means clustering"""
        # Auto-determine number of clusters if not specified
        n_clusters = self.n_clusters or min(max(2, n_items // 5), 10)
        
        clusterer = KMeans(
            n_clusters=n_clusters,
            random_state=42,
            n_init=10
        )
        return clusterer.fit_predict(X)
    
    def _build_clusters(
        self,
        items: List[Dict],
        labels: np.ndarray
    ) -> List[Cluster]:
        """Build Cluster objects from clustering results"""
        clusters = []
        unique_labels = set(labels)
        
        for label_idx, label in enumerate(unique_labels):
            # Skip noise points in DBSCAN (label = -1)
            if label == -1:
                continue
            
            # Get items in this cluster
            cluster_items = [
                items[i] for i in range(len(items))
                if labels[i] == label
            ]
            
            if len(cluster_items) < 2:
                continue
            
            # Calculate cluster center and radius
            positions = [
                (item.get('position_x', 0), item.get('position_y', 0))
                for item in cluster_items
            ]
            center_x = sum(p[0] for p in positions) / len(positions)
            center_y = sum(p[1] for p in positions) / len(positions)
            
            # Radius = max distance from center + padding
            max_dist = max(
                np.sqrt((p[0] - center_x)**2 + (p[1] - center_y)**2)
                for p in positions
            )
            radius = max_dist + 100  # Add padding
            
            # Extract keywords from content
            keywords = self._extract_keywords(cluster_items)
            
            # Generate cluster name
            cluster_name = self._generate_cluster_name(keywords)
            
            cluster = Cluster(
                id=f"cluster-{label}",
                name=cluster_name,
                color=CLUSTER_COLORS[label_idx % len(CLUSTER_COLORS)],
                center_x=center_x,
                center_y=center_y,
                radius=radius,
                item_ids=[item['id'] for item in cluster_items],
                keywords=keywords[:5]
            )
            clusters.append(cluster)
        
        return clusters
    
    def _extract_keywords(self, items: List[Dict], max_keywords: int = 10) -> List[str]:
        """Extract common keywords from cluster items"""
        from collections import Counter
        import re
        
        # Combine all content
        all_text = " ".join(
            item.get('content', '') + " " + item.get('title', '')
            for item in items
        )
        
        # Tokenize and filter
        words = re.findall(r'\b[a-zA-Z]{3,}\b', all_text.lower())
        
        # Remove common stop words
        stop_words = {
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
            'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has',
            'have', 'been', 'will', 'this', 'that', 'with', 'from'
        }
        words = [w for w in words if w not in stop_words]
        
        # Get most common
        counter = Counter(words)
        return [word for word, _ in counter.most_common(max_keywords)]
    
    def _generate_cluster_name(self, keywords: List[str]) -> str:
        """Generate human-readable cluster name from keywords"""
        if not keywords:
            return "Miscellaneous"
        
        # Use top 2-3 keywords
        name_words = keywords[:3]
        
        # Capitalize and join
        return " & ".join(word.capitalize() for word in name_words)


async def generate_cluster_name_with_llm(
    items: List[Dict],
    openai_api_key: Optional[str] = None
) -> str:
    """
    Generate cluster name using LLM (OpenAI or Ollama via LangChain)
    
    Args:
        items: Items in the cluster
        openai_api_key: OpenAI API key (uses env if not provided)
        
    Returns:
        Generated cluster name
    """
    api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
    
    # Prepare content summary
    content_samples = [
        item.get('content', '')[:200]
        for item in items[:5]
    ]
    content_text = "\n---\n".join(content_samples)
    
    prompt = f"Generate a short, descriptive name (max 3 words) for this group of items. Return ONLY the name.\n\nItems:\n{content_text}"
    
    try:
        if api_key:
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                model="gpt-4o-mini",
                api_key=api_key,
                temperature=0.7,
                max_tokens=20
            )
        else:
            # Fallback to Ollama
            from langchain_community.chat_models import ChatOllama
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            # Try efficient models
            llm = ChatOllama(
                base_url=base_url,
                model="llama3",  # User needs to pull this
                temperature=0.7
            )
            
        from langchain_core.messages import HumanMessage, SystemMessage
        
        messages = [
            SystemMessage(content="You are a helpful assistant that generates short names for groups of content. Output ONLY the name."),
            HumanMessage(content=prompt)
        ]
        
        response = await llm.ainvoke(messages)
        return response.content.strip().replace('"', '')
    
    except Exception as e:
        print(f"⚠️  LLM naming failed: {e}")
        # Fallback to keyword-based naming
        return ClusteringService()._generate_cluster_name(
            ClusteringService()._extract_keywords(items)
        )
