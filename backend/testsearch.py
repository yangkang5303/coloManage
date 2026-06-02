from app.db.session import SessionLocal
from app.services.retrieval import search_chunks

db = SessionLocal()

# Test English query
print('=== English Query: P1 response time ===')
results = search_chunks(db, 'P1 response time', limit=3)
for r in results:
    print(f'  Score: {r.get("combined_score", r["score"]):.4f} | {r["document_title"]} | {r["text"][:60]}...')

# Test Chinese query (cross-lingual)
print()
print('=== Chinese Query: 紧急响应时间 ===')
results = search_chunks(db, '紧急响应时间', limit=3)
for r in results:
    print(f'  Score: {r.get("combined_score", r["score"]):.4f} | {r["document_title"]} | {r["text"][:60]}...')

# Test mixed query
print()
print('=== Mixed Query: SLA availability 可用性 ===')
results = search_chunks(db, 'SLA availability 可用性', limit=3)
for r in results:
    print(f'  Score: {r.get("combined_score", r["score"]):.4f} | {r["document_title"]} | {r["text"][:60]}...')

db.close()
print()
print('Hybrid search working correctly!')