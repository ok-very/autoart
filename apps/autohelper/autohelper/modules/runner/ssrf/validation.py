"""
SSRF URL validation functions.

Provides DNS resolution and IP range checking for safe URL access.
"""

import asyncio
import ipaddress
import socket
from urllib.parse import urlparse

from .constants import BLOCKED_HOSTNAMES, DNS_TIMEOUT_SECONDS, PRIVATE_IP_RANGES


class DNSResolutionError(Exception):
    """Raised when DNS resolution fails for a hostname."""

    pass


def _resolve_all_ips(hostname: str) -> list[str]:
    """
    Resolve hostname to all IP addresses (both IPv4 and IPv6).

    Returns:
        List of IP address strings

    Raises:
        DNSResolutionError: If hostname cannot be resolved (DNS failure, timeout, etc.)
    """
    ips = []
    try:
        # Use getaddrinfo to get both IPv4 and IPv6 addresses
        results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for result in results:
            ip_str = result[4][0]
            if ip_str not in ips:
                ips.append(ip_str)
    except (TimeoutError, socket.gaierror, socket.herror, OSError) as e:
        # DNS/network resolution errors should be treated as unsafe
        # - gaierror: address-related errors
        # - herror: legacy host errors
        # - timeout: DNS resolution timeout
        # - OSError: other system-level network errors
        raise DNSResolutionError(f"Failed to resolve hostname '{hostname}': {e}") from e
    return ips


def _check_ips_against_private_ranges(ips: list[str]) -> tuple[bool, str]:
    """
    Check if any of the IPs are in private/internal ranges.

    Returns:
        Tuple of (is_private, error_message)
    """
    for ip_str in ips:
        try:
            ip = ipaddress.ip_address(ip_str)
            for network in PRIVATE_IP_RANGES:
                if ip in network:
                    return True, f"URL resolves to private/internal IP: {ip_str}"
        except ValueError:
            # Invalid IP address format, skip
            continue
    return False, ""


async def is_safe_url(url: str) -> tuple[bool, str]:
    """
    Validate URL to prevent SSRF attacks.

    Checks:
    - Only http/https schemes allowed
    - Hostname not in blocklist
    - Resolved IPs not in private ranges

    Args:
        url: The URL to validate

    Returns:
        Tuple of (is_safe, error_message)
    """
    try:
        parsed = urlparse(url)
    except ValueError as e:
        # urlparse can raise ValueError for malformed URLs
        return False, f"Invalid URL format: {e}"

    # Only allow http/https
    if parsed.scheme not in ("http", "https"):
        return False, f"Unsupported URL scheme: {parsed.scheme}"

    hostname = parsed.hostname
    if not hostname:
        return False, "Invalid URL: no hostname"

    # Check blocked hostnames (normalize trailing dot for FQDN)
    hostname_lower = hostname.lower().rstrip(".")
    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, f"Blocked hostname: {hostname}"

    # Try to resolve hostname and check if IP is private
    # Use asyncio.to_thread to avoid blocking the event loop
    # Resolve all IPs (both IPv4 and IPv6)
    # Add timeout to prevent unbounded blocking on slow/stuck DNS resolution
    try:
        ips = await asyncio.wait_for(
            asyncio.to_thread(_resolve_all_ips, hostname),
            timeout=DNS_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        return (
            False,
            f"DNS resolution timed out after {DNS_TIMEOUT_SECONDS}s for hostname: {hostname}",
        )
    except DNSResolutionError as e:
        # Treat unresolvable hostnames as unsafe to prevent SSRF bypass
        return False, f"DNS resolution failed: {e}"

    if not ips:
        # No IPs resolved (shouldn't happen if no exception, but be defensive)
        return False, f"No IP addresses resolved for hostname: {hostname}"

    is_private, error_msg = _check_ips_against_private_ranges(ips)
    if is_private:
        return False, error_msg

    return True, ""
