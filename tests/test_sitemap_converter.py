"""Unit tests for sitemap_converter."""

import os
import sys
import tempfile
import unittest
from unittest.mock import patch

# Ensure the project root is on the path when running from any directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sitemap_converter import convert_sitemap, extract_links


class TestExtractLinks(unittest.TestCase):
    """Tests for the extract_links() helper."""

    def test_relative_links_resolved(self):
        html = '<a href="/about">About</a><a href="/contact">Contact</a>'
        links = extract_links(html, "https://example.com")
        self.assertIn("https://example.com/about", links)
        self.assertIn("https://example.com/contact", links)

    def test_absolute_internal_links_included(self):
        html = '<a href="https://example.com/page">Page</a>'
        links = extract_links(html, "https://example.com")
        self.assertIn("https://example.com/page", links)

    def test_external_links_excluded(self):
        html = (
            '<a href="https://other.com/page">External</a>'
            '<a href="/internal">Internal</a>'
        )
        links = extract_links(html, "https://example.com")
        self.assertNotIn("https://other.com/page", links)
        self.assertIn("https://example.com/internal", links)

    def test_javascript_links_excluded(self):
        html = '<a href="javascript:void(0)">JS</a><a href="/page">Page</a>'
        links = extract_links(html, "https://example.com")
        self.assertEqual(links, ["https://example.com/page"])

    def test_mailto_links_excluded(self):
        html = '<a href="mailto:user@example.com">Email</a><a href="/page">Page</a>'
        links = extract_links(html, "https://example.com")
        self.assertEqual(links, ["https://example.com/page"])

    def test_tel_links_excluded(self):
        html = '<a href="tel:+15551234567">Call</a><a href="/page">Page</a>'
        links = extract_links(html, "https://example.com")
        self.assertEqual(links, ["https://example.com/page"])

    def test_anchor_only_links_excluded(self):
        html = '<a href="#section">Section</a><a href="/page">Page</a>'
        links = extract_links(html, "https://example.com")
        self.assertEqual(links, ["https://example.com/page"])

    def test_url_fragments_stripped(self):
        html = '<a href="/page#anchor">Page</a>'
        links = extract_links(html, "https://example.com")
        self.assertEqual(links, ["https://example.com/page"])

    def test_deduplicates_links(self):
        html = '<a href="/page">Link 1</a><a href="/page">Link 2</a>'
        links = extract_links(html, "https://example.com")
        self.assertEqual(links, ["https://example.com/page"])

    def test_links_sorted(self):
        html = '<a href="/z-page">Z</a><a href="/a-page">A</a>'
        links = extract_links(html, "https://example.com")
        self.assertEqual(links, sorted(links))

    def test_empty_page_returns_empty_list(self):
        html = "<html><body><p>No links here.</p></body></html>"
        links = extract_links(html, "https://example.com")
        self.assertEqual(links, [])

    def test_wordpress_sitemap_like_structure(self):
        """Simulate a typical WordPress visual sitemap page."""
        html = """
        <html><body>
          <ul class="sitemap">
            <li><a href="/home">Home</a></li>
            <li><a href="/about">About Us</a>
              <ul>
                <li><a href="/about/team">Team</a></li>
                <li><a href="/about/history">History</a></li>
              </ul>
            </li>
            <li><a href="/services">Services</a></li>
            <li><a href="https://external.com/partner">Partner</a></li>
            <li><a href="mailto:info@example.com">Contact</a></li>
          </ul>
        </body></html>
        """
        links = extract_links(html, "https://example.com")
        self.assertIn("https://example.com/home", links)
        self.assertIn("https://example.com/about", links)
        self.assertIn("https://example.com/about/team", links)
        self.assertIn("https://example.com/about/history", links)
        self.assertIn("https://example.com/services", links)
        self.assertNotIn("https://external.com/partner", links)
        self.assertNotIn("mailto:info@example.com", links)


class TestConvertSitemap(unittest.TestCase):
    """Tests for the convert_sitemap() function."""

    @patch("sitemap_converter.fetch_page")
    def test_returns_links(self, mock_fetch):
        mock_fetch.return_value = (
            '<a href="/page1">P1</a><a href="/page2">P2</a>'
        )
        links = convert_sitemap("https://example.com")
        self.assertIn("https://example.com/page1", links)
        self.assertIn("https://example.com/page2", links)

    @patch("sitemap_converter.fetch_page")
    def test_writes_to_file(self, mock_fetch):
        mock_fetch.return_value = '<a href="/page1">P1</a>'
        with tempfile.NamedTemporaryFile(
            mode="r", suffix=".txt", delete=False
        ) as tmp:
            output_path = tmp.name
        try:
            convert_sitemap("https://example.com", output_file=output_path)
            with open(output_path, encoding="utf-8") as fh:
                content = fh.read()
            self.assertEqual(content, "https://example.com/page1\n")
        finally:
            os.unlink(output_path)

    @patch("sitemap_converter.fetch_page")
    def test_output_file_one_link_per_line(self, mock_fetch):
        mock_fetch.return_value = (
            '<a href="/alpha">A</a><a href="/beta">B</a><a href="/gamma">G</a>'
        )
        with tempfile.NamedTemporaryFile(
            mode="r", suffix=".txt", delete=False
        ) as tmp:
            output_path = tmp.name
        try:
            convert_sitemap("https://example.com", output_file=output_path)
            with open(output_path, encoding="utf-8") as fh:
                lines = fh.readlines()
            # Each line should be a URL followed by a newline
            for line in lines:
                self.assertTrue(line.startswith("https://example.com/"))
                self.assertTrue(line.endswith("\n"))
            self.assertEqual(len(lines), 3)
        finally:
            os.unlink(output_path)

    @patch("sitemap_converter.fetch_page")
    def test_empty_sitemap_page(self, mock_fetch):
        mock_fetch.return_value = "<html><body>No links</body></html>"
        links = convert_sitemap("https://example.com")
        self.assertEqual(links, [])


if __name__ == "__main__":
    unittest.main()
