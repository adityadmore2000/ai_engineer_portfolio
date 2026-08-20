import type { BlogPost } from "@/sanity/types";
import Image from "next/image";

export function Blog({ posts }: { posts: BlogPost[] }) {
  if (!posts.length) {
    return null;
  }

  return (
    <section
      id="blog"
      className="w-full bg-white"
      style={{
        paddingTop: "var(--section-padding-y, 100px)",
        paddingBottom: "var(--section-padding-y, 100px)",
        paddingLeft: "var(--section-padding-x, 80px)",
        paddingRight: "var(--section-padding-x, 80px)"
      }}
    >
      <div className="mb-14">
        <h2
          className="heading-display text-[var(--color-dark,#121315)]"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.02em" }}
        >
          BEHIND THE ENGINEERING
        </h2>
        <p
          className="mt-3 text-[var(--color-gray-500,#6b7280)] max-w-xl"
          style={{ fontFamily: "var(--font-inter, sans-serif)" }}
        >
          Thinking out loud on AI systems, evaluation, and building reliable pipelines.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {posts.map((post) => (
          <article
            key={post._id}
            className="group flex flex-col overflow-hidden rounded-[16px] bg-[var(--color-gray-100,#f3f4f6)] transition-shadow hover:shadow-lg"
          >
            {post.coverImage?.url ? (
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <Image
                  src={post.coverImage.url}
                  alt={post.coverImage.alt || post.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                {post.publishedAt ? (
                  <span
                    className="label-mono absolute left-3 top-3 rounded bg-[var(--color-dark,#121315)] px-2 py-1 text-white"
                    style={{ fontSize: "0.65rem" }}
                  >
                    {formatDate(post.publishedAt)}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="relative aspect-[16/9] w-full bg-slate-200 flex items-center justify-center">
                {post.publishedAt ? (
                  <span
                    className="label-mono absolute left-3 top-3 rounded bg-[var(--color-dark,#121315)] px-2 py-1 text-white"
                    style={{ fontSize: "0.65rem" }}
                  >
                    {formatDate(post.publishedAt)}
                  </span>
                ) : null}
              </div>
            )}

            <div className="flex flex-1 flex-col gap-2 p-6">
              <h3
                className="text-lg font-bold text-[var(--color-dark,#121315)] leading-snug"
                style={{ fontFamily: "var(--font-outfit, sans-serif)" }}
              >
                {post.title}
              </h3>
              {post.summary ? (
                <p
                  className="text-sm text-[var(--color-gray-500,#6b7280)] leading-relaxed line-clamp-3"
                  style={{ fontFamily: "var(--font-inter, sans-serif)" }}
                >
                  {post.summary}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(dateStr));
}
