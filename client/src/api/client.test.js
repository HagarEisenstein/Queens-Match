import apiClient, {
  searchMentors,
  verifyMentorSearchEmbedding,
} from "./client";

describe("verifyMentorSearchEmbedding", () => {
  afterEach(() => jest.restoreAllMocks());

  it("posts only the mentor search query", async () => {
    const post = jest.spyOn(apiClient, "post").mockResolvedValue({
      data: { ok: true, dimension: 3072 },
    });

    await verifyMentorSearchEmbedding("Help with backend interviews");

    expect(post).toHaveBeenCalledWith("/mentor-search/embedding", {
      query: "Help with backend interviews",
    });
  });
});

describe("searchMentors", () => {
  afterEach(() => jest.restoreAllMocks());

  it("posts only the raw query text to hybrid mentor search", async () => {
    const post = jest.spyOn(apiClient, "post").mockResolvedValue({
      data: { mentors: [] },
    });

    await searchMentors("Help with backend interviews");

    expect(post).toHaveBeenCalledWith("/mentor-search", {
      query: "Help with backend interviews",
    });
  });
});
